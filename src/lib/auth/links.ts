import "server-only";
import type { AppLocale } from "@/i18n/routing";
import { serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Builds a single-use auth link (recovery or invite) that points to our own
 * confirmation page. The token is a hashed OTP that expires per the project's
 * OTP expiry (24 h) and is consumed on first verification. Generating a new
 * link replaces the previous token of the same kind.
 */
export async function generateRecoveryLink(email: string, locale: AppLocale): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email });
  if (error || !data.properties?.hashed_token) return null;
  return confirmUrl(data.properties.hashed_token, "recovery", locale);
}

export function confirmUrl(tokenHash: string, type: "recovery" | "invite", locale: AppLocale): string {
  const base = serverEnv().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const params = new URLSearchParams({ token_hash: tokenHash, type });
  return `${base}/${locale}/auth/confirm?${params.toString()}`;
}

/**
 * Creates (or, for a still-unconfirmed account, re-issues) an invitation and
 * returns its single-use link. The profile is created by the on_auth_user_created
 * trigger with role 'user'; full_name and preferred_locale come from metadata.
 */
export async function generateInviteLink(input: {
  email: string;
  fullName: string;
  locale: AppLocale;
}): Promise<{ userId: string; url: string } | { error: string }> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "invite",
    email: input.email,
    options: { data: { full_name: input.fullName, preferred_locale: input.locale } },
  });
  if (error || !data.properties?.hashed_token || !data.user) return { error: error?.code ?? "unknown" };
  return { userId: data.user.id, url: confirmUrl(data.properties.hashed_token, "invite", input.locale) };
}
