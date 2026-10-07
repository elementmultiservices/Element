import "server-only";
import { createElement } from "react";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { ActionEmail } from "./templates/action-email";
import { sendEmail } from "./send";

type AuthEmailKind = "passwordReset" | "invitation" | "passwordForced";

/** Sends a localized auth-link email (reset, invitation, forced reset) in the recipient's language. */
export async function sendAuthLinkEmail(input: {
  kind: AuthEmailKind;
  to: string;
  locale: AppLocale;
  name: string;
  url: string;
}): Promise<boolean> {
  const t = await getTranslations({ locale: input.locale, namespace: "Email" });
  const k = input.kind;
  const name = input.name.trim();

  const react = createElement(ActionEmail, {
    locale: input.locale,
    preview: t(`${k}.preview`),
    heading: t(`${k}.heading`),
    greeting: name ? t(`${k}.greeting`, { name }) : t(`${k}.greetingFallback`),
    body: t(`${k}.body`),
    ctaLabel: t(`${k}.cta`),
    ctaUrl: input.url,
    expiry: t(`${k}.expiry`),
    ignore: t(`${k}.ignore`),
    linkFallback: t("linkFallback"),
    automatedNotice: t("automatedNotice"),
    footerAddress: t("footerAddress"),
  });

  return sendEmail({ to: input.to, subject: `${t(`${k}.subject`)} | Element`, react });
}
