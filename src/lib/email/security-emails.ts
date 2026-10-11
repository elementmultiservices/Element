import "server-only";
import { createElement } from "react";
import { getTranslations } from "next-intl/server";
import { isAppLocale } from "@/i18n/routing";
import { serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { ActionEmail } from "./templates/action-email";
import { sendEmail } from "./send";

type Notice =
  | { kind: "recoveryUsed"; userId: string }
  | { kind: "roleChanged"; userId: string; role: "user" | "admin" }
  | { kind: "uploadGranted"; userId: string };

/**
 * Security notifications sent to the account owner, in their language, when
 * something sensitive changes on their account.
 */
export async function sendSecurityNotice(notice: Notice): Promise<void> {
  const admin = createAdminClient();
  const [{ data: profile }, { data: userData }] = await Promise.all([
    admin.from("profiles").select("full_name, preferred_locale, is_active").eq("id", notice.userId).maybeSingle(),
    admin.auth.admin.getUserById(notice.userId),
  ]);
  const email = userData.user?.email;
  if (!profile?.is_active || !email) return;

  const locale = isAppLocale(profile.preferred_locale) ? profile.preferred_locale : "en";
  const t = await getTranslations({ locale, namespace: "Email" });
  const name = profile.full_name.trim();
  const base = serverEnv().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const k = notice.kind;
  const body =
    notice.kind === "roleChanged"
      ? t(notice.role === "admin" ? "roleChanged.bodyAdmin" : "roleChanged.bodyUser")
      : t(`${notice.kind}.body`);

  const react = createElement(ActionEmail, {
    locale,
    preview: t(`${k}.preview`),
    heading: t(`${k}.heading`),
    greeting: name ? t(`${k}.greeting`, { name }) : t(`${k}.greetingFallback`),
    body,
    ctaLabel: t(`${k}.cta`),
    ctaUrl: `${base}/${locale}/sign-in`,
    ignore: t(`${k}.ignore`),
    linkFallback: t("linkFallback"),
    automatedNotice: t("automatedNotice"),
    footerAddress: t("footerAddress"),
  });
  await sendEmail({ to: email, subject: `${t(`${k}.subject`)} | Element`, react });
}
