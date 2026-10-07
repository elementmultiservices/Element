import "server-only";
import { createElement } from "react";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { serverEnv } from "@/lib/env";
import { ActionEmail } from "./templates/action-email";
import { sendEmail } from "./send";

/**
 * Notifies the organization inbox of a new contact message. The visitor's text
 * is passed as plain React text (escaped); it is truncated in the email and
 * read in full in the admin panel.
 */
export async function sendContactNotification(input: {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  locale: AppLocale;
}): Promise<void> {
  const env = serverEnv();
  if (!env.CONTACT_INBOX) return;
  // The inbox belongs to the organization: Spanish is used for its notifications.
  const t = await getTranslations({ locale: "es", namespace: "Email" });
  const excerpt = input.message.length > 600 ? `${input.message.slice(0, 600)}…` : input.message;

  const react = createElement(ActionEmail, {
    locale: "es",
    preview: t("contactNotice.preview"),
    heading: t("contactNotice.heading"),
    greeting: t("contactNotice.greeting"),
    body: t("contactNotice.body", {
      name: input.name,
      email: input.email,
      subject: input.subject,
      language: input.locale.toUpperCase(),
      message: excerpt,
    }),
    ctaLabel: t("contactNotice.cta"),
    ctaUrl: `${env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/es/admin/messages?status=pending`,
    linkFallback: t("linkFallback"),
    automatedNotice: t("automatedNotice"),
    footerAddress: t("footerAddress"),
  });

  // Visitor input never reaches headers unsanitized: line breaks are removed.
  const subjectLine = input.subject.replace(/[\r\n\t]+/g, " ").slice(0, 80);
  await sendEmail({ to: env.CONTACT_INBOX, subject: `${t("contactNotice.subject", { subject: subjectLine })} | Element`, react });
}

/** Short, non-sequential reference shown to the sender (derived from the message id). */
export function contactReference(id: string): string {
  return id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

/**
 * Acknowledgement to the person who wrote. Deliberately contains NO text from
 * the form (not even the name): if someone types another person's address, the
 * recipient only gets a neutral notice, so the form cannot carry spam or
 * phishing content.
 */
export async function sendContactAcknowledgement(input: { to: string; reference: string; locale: AppLocale }): Promise<void> {
  const env = serverEnv();
  const t = await getTranslations({ locale: input.locale, namespace: "Email" });
  const react = createElement(ActionEmail, {
    locale: input.locale,
    preview: t("contactAck.preview"),
    heading: t("contactAck.heading"),
    greeting: t("contactAck.greeting"),
    body: t("contactAck.body", { reference: input.reference }),
    ctaLabel: t("contactAck.cta"),
    ctaUrl: `${env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/${input.locale}`,
    ignore: t("contactAck.ignore"),
    linkFallback: t("linkFallback"),
    automatedNotice: t("automatedNotice"),
    footerAddress: t("footerAddress"),
  });
  await sendEmail({ to: input.to, subject: `${t("contactAck.subject", { reference: input.reference })} | Element`, react });
}
