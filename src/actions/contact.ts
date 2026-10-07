"use server";

import { after } from "next/server";
import { getLocale } from "next-intl/server";
import { toLocale } from "@/i18n/routing";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/session";
import { contactReference, sendContactAcknowledgement, sendContactNotification } from "@/lib/email/contact-email";
import { fieldErrorsFrom, type FormState } from "@/lib/forms";
import { hashIdentifier } from "@/lib/security/hash";
import { rateLimit } from "@/lib/security/rate-limit";
import { checkFormToken } from "@/lib/security/form-token";
import { assessRecaptcha } from "@/lib/security/recaptcha";
import { requestMeta } from "@/lib/security/request-meta";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { idSchema } from "@/lib/validation/admin";
import { contactSchema } from "@/lib/validation/blog";

export type ContactField = "name" | "email" | "subject" | "message" | "consent";

/** reCAPTCHA score required to send the acknowledgement (stricter than accepting the message). */
const ACK_MIN_SCORE = 0.7;

/**
 * Public contact form: validation, honeypot, time trap, reCAPTCHA, per-IP and
 * per-email limits. Messages are stored with the service role (there is no
 * public insert policy); the inbox is notified after the response is sent.
 *
 * The sender also receives an acknowledgement, guarded so the form cannot be
 * used to send email to arbitrary people:
 *   - the email contains NO visitor-supplied text (only a reference number),
 *     so it is useless as a spam or phishing carrier;
 *   - at most one acknowledgement per address every 24 h and a global daily cap;
 *   - a stricter reCAPTCHA score than the one needed to accept the message.
 */
export async function submitContactAction(_prev: FormState<ContactField>, formData: FormData): Promise<FormState<ContactField>> {
  const meta = await requestMeta();
  const locale = toLocale(await getLocale());

  // Honeypot: real visitors never fill this hidden field. Pretend success.
  const trap = formData.get("website");
  if (typeof trap === "string" && trap.trim() !== "") return { status: "success" };

  // Time trap: bots submit instantly; a stale page asks for a reload.
  const timing = await checkFormToken(formData.get("formToken"), "contact");
  if (timing === "expired") return { status: "error", error: "formExpired" };
  if (timing !== "ok") return { status: "success" };

  const parsed = contactSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    subject: formData.get("subject"),
    message: formData.get("message"),
    consent: formData.get("consent"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom<ContactField>(parsed.error) };

  const recaptcha = await assessRecaptcha(formData.get("recaptchaToken"), "contact", meta.ip);
  if (!recaptcha.ok) return { status: "error", error: "recaptchaFailed" };
  if (!(await rateLimit("contactIp", meta.ip)).success) return { status: "error", error: "rateLimited" };
  if (!(await rateLimit("contactEmail", hashIdentifier(parsed.data.email))).success) return { status: "error", error: "rateLimited" };

  const { name, email, subject, message } = parsed.data;
  const { data, error } = await createAdminClient()
    .from("contact_messages")
    .insert({ name, email, subject, message, locale })
    .select("id")
    .single();
  if (error || !data) {
    console.error(`[contact] insert failed: ${error?.code ?? "none"}`);
    return { status: "error", error: "generic" };
  }

  const acknowledge = await mayAcknowledge(email, recaptcha.score);

  // No personal data in the audit metadata; the message itself is the record.
  await audit(
    { actorId: null, action: "contact.received", targetType: "contact", targetId: data.id, metadata: { locale, acknowledgement: acknowledge ? "sent" : "skipped" } },
    meta,
  );
  after(async () => {
    try {
      await sendContactNotification({ id: data.id, name, email, subject, message, locale });
      if (acknowledge) await sendContactAcknowledgement({ to: email, reference: contactReference(data.id), locale });
    } catch {
      console.error("[contact] notification failed");
    }
  });
  return { status: "success" };
}

/** Anti-abuse gate for the acknowledgement email (see the action comment). */
async function mayAcknowledge(email: string, score: number | null): Promise<boolean> {
  if (score !== null && score < ACK_MIN_SCORE) return false;
  if (!(await rateLimit("contactAckRecipient", hashIdentifier(email))).success) return false;
  return (await rateLimit("contactAckGlobal", "all")).success;
}

async function setHandled(formData: FormData, handled: boolean): Promise<FormState<never>> {
  const session = await requireAdmin();
  if (!(await rateLimit("adminActionUser", session.userId)).success) return { status: "error", error: "rateLimited" };
  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { status: "error", error: "notFound" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contact_messages")
    .update({
      is_handled: handled,
      handled_by: handled ? session.userId : null,
      handled_at: handled ? new Date().toISOString() : null,
    })
    .eq("id", parsed.data.id)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error(`[contact] update failed: ${error.code}`);
    return { status: "error", error: "generic" };
  }
  if (!data) return { status: "error", error: "notFound" };

  await audit({ actorId: session.userId, action: handled ? "contact.handled" : "contact.reopened", targetType: "contact", targetId: data.id });
  return { status: "success" };
}

export async function markMessageHandledAction(_prev: FormState<never>, formData: FormData): Promise<FormState<never>> {
  return setHandled(formData, true);
}

export async function reopenMessageAction(_prev: FormState<never>, formData: FormData): Promise<FormState<never>> {
  return setHandled(formData, false);
}
