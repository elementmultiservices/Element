import "server-only";
import { createElement } from "react";
import { getTranslations } from "next-intl/server";
import { isAppLocale } from "@/i18n/routing";
import { audit } from "@/lib/audit";
import { serverEnv } from "@/lib/env";
import type { RequestMeta } from "@/lib/security/request-meta";
import { createAdminClient } from "@/lib/supabase/admin";
import { ActionEmail } from "./templates/action-email";
import { sendEmail } from "./send";

type Notice =
  | { kind: "recoveryUsed"; userId: string }
  | { kind: "roleChanged"; userId: string; role: "user" | "admin" }
  | { kind: "uploadGranted"; userId: string }
  | { kind: "passwordChanged"; userId: string; created: boolean };

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
      : notice.kind === "passwordChanged"
        ? t(notice.created ? "passwordChanged.bodyCreated" : "passwordChanged.bodyChanged")
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

/**
 * Called when an account's address is first verified (email link or Google).
 * Upload access granted before that moment — a pre-authorized address applied
 * by the database trigger, or a grant given while the account was still
 * unverified — sent no email, so the owner is told now. Accounts invited by an
 * administrator are skipped (the invitation already implies the access), and
 * the notice is sent at most once per account.
 */
export async function notifyUploadGrantOnVerification(userId: string, meta: RequestMeta): Promise<void> {
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role, can_upload, is_active").eq("id", userId).maybeSingle();
  if (!profile?.is_active || !profile.can_upload || profile.role !== "user") return;

  const { count, error } = await admin
    .from("audit_logs")
    .select("id", { count: "exact", head: true })
    .eq("target_id", userId)
    .in("action", ["user.invited", "user.invitation_resent", "user.upload.grant_notified"]);
  if (error || (count ?? 0) > 0) return;

  await audit({ actorId: null, action: "user.upload.grant_notified", targetType: "user", targetId: userId }, meta);
  await sendSecurityNotice({ kind: "uploadGranted", userId });
}
