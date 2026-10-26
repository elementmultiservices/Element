import "server-only";
import type { AppLocale } from "@/i18n/routing";
import { audit } from "@/lib/audit";
import { generateInviteLink } from "@/lib/auth/links";
import { sendAuthLinkEmail } from "@/lib/email/auth-emails";
import type { RequestMeta } from "@/lib/security/request-meta";
import { createAdminClient } from "@/lib/supabase/admin";

const MB = 1024 * 1024;

export type InviteResult = { ok: true; userId: string; sent: boolean } | { ok: false; error: "emailExists" | "generic" };

/**
 * Creates a client account (role 'user') and emails its invitation link. Shared
 * by the invite form and by "create an account" on an unassigned intake form.
 * Invited accounts are authorized to upload from the start.
 */
export async function inviteClient(
  input: { adminId: string; fullName: string; email: string; locale: AppLocale; quotaMb: number; source?: string },
  meta?: RequestMeta,
): Promise<InviteResult> {
  const { adminId, fullName, email, locale, quotaMb } = input;
  const admin = createAdminClient();
  const { data: existing } = await admin.rpc("auth_user_id_by_email", { p_email: email });
  if (existing) return { ok: false, error: "emailExists" };

  const link = await generateInviteLink({ email, fullName, locale });
  if ("error" in link) {
    if (link.error === "email_exists") return { ok: false, error: "emailExists" };
    console.error(`[admin] invite failed: ${link.error}`);
    return { ok: false, error: "generic" };
  }

  const { error: quotaError } = await admin
    .from("profiles")
    .update({ storage_quota_bytes: quotaMb * MB, can_upload: true })
    .eq("id", link.userId);
  if (quotaError) console.error(`[admin] invite profile update failed: ${quotaError.code}`);

  await audit(
    {
      actorId: adminId,
      action: "user.invited",
      targetType: "user",
      targetId: link.userId,
      metadata: { locale, quota_mb: quotaMb, ...(input.source ? { source: input.source } : {}) },
    },
    meta,
  );

  const sent = await sendAuthLinkEmail({ kind: "invitation", to: email, locale, name: fullName, url: link.url });
  return { ok: true, userId: link.userId, sent };
}
