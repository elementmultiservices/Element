"use server";

import { getLocale } from "next-intl/server";
import { z } from "zod";
import { toLocale } from "@/i18n/routing";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/session";
import { effectiveStatus, getAdminPost } from "@/lib/blog/queries";
import { fieldErrorsFrom, type FormState } from "@/lib/forms";
import { newsletterNotMigrated } from "@/lib/newsletter/queries";
import { sendPostToSubscribers, type Recipient } from "@/lib/newsletter/send";
import { hashIdentifier } from "@/lib/security/hash";
import { checkFormToken } from "@/lib/security/form-token";
import { rateLimit } from "@/lib/security/rate-limit";
import { assessRecaptcha } from "@/lib/security/recaptcha";
import { requestMeta } from "@/lib/security/request-meta";
import { getSiteSettings } from "@/lib/site-settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { emailSchema } from "@/lib/validation/auth";
import { idSchema } from "@/lib/validation/admin";

export type NewsletterField = "email";

const SOURCES = ["footer", "home", "blog"] as const;
const subscribeSchema = z.object({
  email: emailSchema,
  source: z.enum(SOURCES).catch("footer"),
});

/** Largest list read for one send; well above a local office's audience. */
const MAX_RECIPIENTS = 20_000;

/**
 * Public sign-up. Same protections as the contact form (honeypot, time trap,
 * reCAPTCHA, per-IP and per-email limits). The response never reveals whether
 * the address was already subscribed.
 */
export async function subscribeNewsletterAction(_prev: FormState<NewsletterField>, formData: FormData): Promise<FormState<NewsletterField>> {
  const meta = await requestMeta();
  const locale = toLocale(await getLocale());

  const trap = formData.get("website");
  if (typeof trap === "string" && trap.trim() !== "") return { status: "success" };

  const timing = await checkFormToken(formData.get("formToken"), "newsletter");
  if (timing === "expired") return { status: "error", error: "formExpired" };
  if (timing !== "ok") return { status: "success" };

  const parsed = subscribeSchema.safeParse({ email: formData.get("email"), source: formData.get("source") });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom<NewsletterField>(parsed.error) };

  const recaptcha = await assessRecaptcha(formData.get("recaptchaToken"), "newsletter", meta.ip);
  if (!recaptcha.ok) return { status: "error", error: "recaptchaFailed" };
  if (!(await rateLimit("newsletterIp", meta.ip)).success) return { status: "error", error: "rateLimited" };
  const email = parsed.data.email.toLowerCase();
  if (!(await rateLimit("newsletterEmail", hashIdentifier(email))).success) return { status: "error", error: "rateLimited" };

  const db = createAdminClient();
  const { data: existing, error: readError } = await db
    .from("newsletter_subscribers")
    .select("id, unsubscribed_at")
    .eq("email", email)
    .maybeSingle();
  if (readError) {
    console.error(`[newsletter] read failed: ${readError.code}`);
    return { status: "error", error: newsletterNotMigrated(readError.code) ? "migrationPending" : "generic" };
  }

  if (!existing) {
    const { data, error } = await db
      .from("newsletter_subscribers")
      .insert({ email, locale, source: parsed.data.source })
      .select("id")
      .single();
    if (error) {
      // A concurrent sign-up with the same address is fine.
      if (error.code !== "23505") {
        console.error(`[newsletter] insert failed: ${error.code}`);
        return { status: "error", error: "generic" };
      }
    } else {
      await audit({ actorId: null, action: "newsletter.subscribed", targetType: "subscriber", targetId: data.id, metadata: { locale, source: parsed.data.source } }, meta);
    }
  } else if (existing.unsubscribed_at) {
    // Coming back: resubscribe with the current language.
    await db.from("newsletter_subscribers").update({ unsubscribed_at: null, locale, source: parsed.data.source }).eq("id", existing.id);
    await audit({ actorId: null, action: "newsletter.subscribed", targetType: "subscriber", targetId: existing.id, metadata: { locale, resubscribed: true } }, meta);
  }
  return { status: "success" };
}

/** Unsubscribe from the link in an email (token identifies the subscriber). */
export async function unsubscribeNewsletterAction(_prev: FormState<never>, formData: FormData): Promise<FormState<never>> {
  const meta = await requestMeta();
  if (!(await rateLimit("newsletterUnsubscribeIp", meta.ip)).success) return { status: "error", error: "rateLimited" };
  const token = z.uuid().safeParse(formData.get("token"));
  if (!token.success) return { status: "error", error: "linkInvalid" };
  const ok = await unsubscribeByToken(token.data);
  return ok ? { status: "success" } : { status: "error", error: "linkInvalid" };
}

/** Shared by the unsubscribe page and the one-click List-Unsubscribe endpoint. */
export async function unsubscribeByToken(token: string): Promise<boolean> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("newsletter_subscribers")
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq("unsubscribe_token", token)
    .is("unsubscribed_at", null)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error(`[newsletter] unsubscribe failed: ${error.code}`);
    return false;
  }
  if (data) await audit({ actorId: null, action: "newsletter.unsubscribed", targetType: "subscriber", targetId: data.id });
  else {
    // Already unsubscribed is still a success; an unknown token is not.
    const { data: known } = await db.from("newsletter_subscribers").select("id").eq("unsubscribe_token", token).maybeSingle();
    return !!known;
  }
  return true;
}

/** Admin: remove a subscriber from the list entirely. */
export async function removeSubscriberAction(_prev: FormState<never>, formData: FormData): Promise<FormState<never>> {
  const session = await requireAdmin();
  if (!(await rateLimit("adminActionUser", session.userId)).success) return { status: "error", error: "rateLimited" };
  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { status: "error", error: "notFound" };
  const supabase = await createClient();
  const { data, error } = await supabase.from("newsletter_subscribers").delete().eq("id", parsed.data.id).select("id").maybeSingle();
  if (error) {
    console.error(`[newsletter] remove failed: ${error.code}`);
    return { status: "error", error: "generic" };
  }
  if (!data) return { status: "error", error: "notFound" };
  await audit({ actorId: session.userId, action: "newsletter.removed", targetType: "subscriber", targetId: data.id });
  return { status: "success" };
}

/** Admin: email a published post to every active subscriber. */
export async function sendPostNewsletterAction(_prev: FormState<never>, formData: FormData): Promise<FormState<never>> {
  const session = await requireAdmin();
  if (!(await rateLimit("newsletterSendUser", session.userId)).success) return { status: "error", error: "rateLimited" };
  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { status: "error", error: "notFound" };

  const supabase = await createClient();
  const post = await getAdminPost(supabase, parsed.data.id);
  if (!post) return { status: "error", error: "notFound" };
  if (effectiveStatus(post) !== "published") return { status: "error", error: "notPublished" };

  const { data: rows, error } = await supabase
    .from("newsletter_subscribers")
    .select("email, locale, unsubscribe_token")
    .is("unsubscribed_at", null)
    .order("created_at")
    .limit(MAX_RECIPIENTS);
  if (error) return { status: "error", error: newsletterNotMigrated(error.code) ? "migrationPending" : "generic" };
  const recipients: Recipient[] = (rows ?? []).map((r) => ({ email: r.email, locale: r.locale, token: r.unsubscribe_token }));
  if (recipients.length === 0) return { status: "error", error: "noSubscribers" };

  const settings = await getSiteSettings();
  const { sent, failed } = await sendPostToSubscribers(post, recipients, settings.address);
  const title = post.translations.es?.title ?? post.translations.en?.title ?? "";

  // newsletter_sends has no client insert policy: written with the service role.
  await createAdminClient()
    .from("newsletter_sends")
    .insert({ post_id: post.id, title: title.slice(0, 200) || "—", recipients: sent, failed, sent_by: session.userId });
  await audit({ actorId: session.userId, action: "newsletter.sent", targetType: "post", targetId: post.id, metadata: { sent, failed, title } });

  if (sent === 0) return { status: "error", error: "deliveryFailed" };
  return { status: "success" };
}
