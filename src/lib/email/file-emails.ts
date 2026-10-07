import "server-only";
import { createElement } from "react";
import { getTranslations } from "next-intl/server";
import { isAppLocale } from "@/i18n/routing";
import { serverEnv } from "@/lib/env";
import { sanitizeDisplayName } from "@/lib/files/rules";
import { createAdminClient } from "@/lib/supabase/admin";
import { ActionEmail } from "./templates/action-email";
import { sendEmail } from "./send";

/** Notifies a user, in their preferred language, that an administrator added a file to their account. */
export async function sendFileAssignedEmail(ownerId: string, originalName: string): Promise<void> {
  const admin = createAdminClient();
  const [{ data: profile }, { data: userData }] = await Promise.all([
    admin.from("profiles").select("full_name, preferred_locale, is_active").eq("id", ownerId).maybeSingle(),
    admin.auth.admin.getUserById(ownerId),
  ]);
  const email = userData.user?.email;
  if (!profile?.is_active || !email) return;

  const locale = isAppLocale(profile.preferred_locale) ? profile.preferred_locale : "en";
  const t = await getTranslations({ locale, namespace: "Email" });
  const name = profile.full_name.trim();
  const url = `${serverEnv().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/${locale}/dashboard`;

  const react = createElement(ActionEmail, {
    locale,
    preview: t("fileAssigned.preview"),
    heading: t("fileAssigned.heading"),
    greeting: name ? t("fileAssigned.greeting", { name }) : t("fileAssigned.greetingFallback"),
    body: t("fileAssigned.body", { fileName: sanitizeDisplayName(originalName) }),
    ctaLabel: t("fileAssigned.cta"),
    ctaUrl: url,
    linkFallback: t("linkFallback"),
    automatedNotice: t("automatedNotice"),
    footerAddress: t("footerAddress"),
  });

  await sendEmail({ to: email, subject: `${t("fileAssigned.subject")} | Element`, react });
}
