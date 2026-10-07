"use server";

import { after } from "next/server";
import { getLocale } from "next-intl/server";
import { toLocale } from "@/i18n/routing";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/session";
import { sendContactNotification } from "@/lib/email/contact-email";
import { fieldErrorsFrom, type FormState } from "@/lib/forms";
import { hashIdentifier } from "@/lib/security/hash";
import { rateLimit } from "@/lib/security/rate-limit";
import { verifyRecaptcha } from "@/lib/security/recaptcha";
import { requestMeta } from "@/lib/security/request-meta";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { idSchema } from "@/lib/validation/admin";
import { contactSchema } from "@/lib/validation/blog";

export type ContactField = "name" | "email" | "subject" | "message" | "consent";

/**
 * Public contact form: validation, honeypot, reCAPTCHA, per-IP and per-email
 * limits. Messages are stored with the service role (there is no public insert
 * policy) and the inbox is notified after the response is sent.
 */
export async function submitContactAction(_prev: FormState<ContactField>, formData: FormData): Promise<FormState<ContactField>> {
  const meta = await requestMeta();
  const locale = toLocale(await getLocale());

  // Honeypot: real visitors never fill this hidden field. Pretend success.
  const trap = formData.get("website");
  if (typeof trap === "string" && trap.trim() !== "") return { status: "success" };

  const parsed = contactSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    subject: formData.get("subject"),
    message: formData.get("message"),
    consent: formData.get("consent"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom<ContactField>(parsed.error) };

  if (!(await verifyRecaptcha(formData.get("recaptchaToken"), "contact", meta.ip))) return { status: "error", error: "recaptchaFailed" };
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

  // No personal data in the audit metadata; the message itself is the record.
  await audit({ actorId: null, action: "contact.received", targetType: "contact", targetId: data.id, metadata: { locale } }, meta);
  after(async () => {
    try {
      await sendContactNotification({ id: data.id, name, email, subject, message, locale });
    } catch {
      console.error("[contact] notification failed");
    }
  });
  return { status: "success" };
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
