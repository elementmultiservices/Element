"use server";

import { randomBytes } from "node:crypto";
import { after } from "next/server";
import { getUser } from "@/lib/admin/queries";
import { audit } from "@/lib/audit";
import { generateInviteLink, generateRecoveryLink } from "@/lib/auth/links";
import { requireAdmin, type SessionContext } from "@/lib/auth/session";
import { sendAuthLinkEmail } from "@/lib/email/auth-emails";
import { sendSecurityNotice } from "@/lib/email/security-emails";
import { fieldErrorsFrom, type ErrorKey, type FormState } from "@/lib/forms";
import { rateLimit } from "@/lib/security/rate-limit";
import { requestMeta } from "@/lib/security/request-meta";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { idLast4Schema, idSchema, inviteUserSchema, quotaSchema, roleChangeSchema, uploadGrantSchema } from "@/lib/validation/admin";

const MB = 1024 * 1024;
const BAN_FOREVER = "876000h"; // ~100 years

type Result = FormState<never>;

async function guard(limit: "adminActionUser" | "adminInviteUser" | "adminEmailUser" | "adminGrantUser" = "adminActionUser"): Promise<
  { ok: true; session: SessionContext } | { ok: false; result: Result }
> {
  const session = await requireAdmin();
  if (!(await rateLimit(limit, session.userId)).success) return { ok: false, result: { status: "error", error: "rateLimited" } };
  return { ok: true, session };
}

/** Maps errors raised by the protect_profile_columns trigger to user-facing keys. */
function profileErrorKey(message: string | undefined): ErrorKey {
  if (message?.includes("last_admin")) return "lastAdmin";
  if (message?.includes("self_privilege_change")) return "selfAction";
  return "generic";
}

function parseId(formData: FormData): string | null {
  const parsed = idSchema.safeParse({ id: formData.get("id") });
  return parsed.success ? parsed.data.id : null;
}

// ---------------------------------------------------------------------------
// Invite (role is always 'user'; admins are created only by the bootstrap script)
// ---------------------------------------------------------------------------
export type InviteField = "fullName" | "email" | "locale" | "quotaMb";
export type InviteState = FormState<InviteField> & { invitedId?: string; invitedEmail?: string };

export async function inviteUserAction(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const g = await guard("adminInviteUser");
  if (!g.ok) return g.result;
  const meta = await requestMeta();

  const parsed = inviteUserSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    locale: formData.get("locale"),
    quotaMb: formData.get("quotaMb"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom<InviteField>(parsed.error) };
  const { fullName, email, locale, quotaMb } = parsed.data;

  const admin = createAdminClient();
  const { data: existing } = await admin.rpc("auth_user_id_by_email", { p_email: email });
  if (existing) return { status: "error", error: "emailExists" };

  const link = await generateInviteLink({ email, fullName, locale });
  if ("error" in link) {
    if (link.error === "email_exists") return { status: "error", error: "emailExists" };
    console.error(`[admin] invite failed: ${link.error}`);
    return { status: "error", error: "generic" };
  }

  // Invited accounts are authorized to upload from the start.
  const { error: quotaError } = await admin
    .from("profiles")
    .update({ storage_quota_bytes: quotaMb * MB, can_upload: true })
    .eq("id", link.userId);
  if (quotaError) console.error(`[admin] invite profile update failed: ${quotaError.code}`);

  await audit(
    { actorId: g.session.userId, action: "user.invited", targetType: "user", targetId: link.userId, metadata: { locale, quota_mb: quotaMb } },
    meta,
  );

  const sent = await sendAuthLinkEmail({ kind: "invitation", to: email, locale, name: fullName, url: link.url });
  if (!sent) return { status: "error", error: "deliveryFailed", invitedId: link.userId, invitedEmail: email };
  return { status: "success", invitedId: link.userId, invitedEmail: email };
}

// ---------------------------------------------------------------------------
// Resend invitation (only while the account has not been activated)
// ---------------------------------------------------------------------------
export async function resendInvitationAction(_prev: Result, formData: FormData): Promise<Result> {
  const g = await guard("adminEmailUser");
  if (!g.ok) return g.result;
  const id = parseId(formData);
  if (!id) return { status: "error", error: "notFound" };

  const supabase = await createClient();
  const user = await getUser(supabase, id);
  if (!user) return { status: "error", error: "notFound" };
  if (!user.invitationPending) return { status: "error", error: "notPending" };

  const link = await generateInviteLink({ email: user.email, fullName: user.fullName, locale: user.locale });
  if ("error" in link) {
    if (link.error === "email_exists") return { status: "error", error: "notPending" };
    console.error(`[admin] resend invite failed: ${link.error}`);
    return { status: "error", error: "generic" };
  }
  await audit({ actorId: g.session.userId, action: "user.invitation_resent", targetType: "user", targetId: id });

  const sent = await sendAuthLinkEmail({ kind: "invitation", to: user.email, locale: user.locale, name: user.fullName, url: link.url });
  return sent ? { status: "success" } : { status: "error", error: "deliveryFailed" };
}

// ---------------------------------------------------------------------------
// Activate / deactivate. Deactivation takes effect immediately: the profile flag
// is checked by RLS and the proxy on every request, the auth user is banned and
// every session (with its refresh tokens) is revoked.
// ---------------------------------------------------------------------------
async function setActive(formData: FormData, active: boolean): Promise<Result> {
  const g = await guard();
  if (!g.ok) return g.result;
  const id = parseId(formData);
  if (!id) return { status: "error", error: "notFound" };
  if (id === g.session.userId) return { status: "error", error: "selfAction" };

  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").update({ is_active: active }).eq("id", id).select("id").maybeSingle();
  if (error) return { status: "error", error: profileErrorKey(error.message) };
  if (!data) return { status: "error", error: "notFound" };

  const admin = createAdminClient();
  const { error: banError } = await admin.auth.admin.updateUserById(id, { ban_duration: active ? "none" : BAN_FOREVER });
  if (banError) console.error(`[admin] ban update failed: ${banError.code ?? "unknown"}`);
  if (!active) {
    const { error: revokeError } = await admin.rpc("revoke_user_sessions", { p_user: id });
    if (revokeError) console.error(`[admin] session revocation failed: ${revokeError.code}`);
  }

  await audit({ actorId: g.session.userId, action: active ? "user.activated" : "user.deactivated", targetType: "user", targetId: id });
  return { status: "success" };
}

export async function deactivateUserAction(_prev: Result, formData: FormData): Promise<Result> {
  return setActive(formData, false);
}

export async function activateUserAction(_prev: Result, formData: FormData): Promise<Result> {
  return setActive(formData, true);
}

// ---------------------------------------------------------------------------
// Force password reset: the current password stops working (replaced by a
// random one nobody knows), sessions are revoked and a recovery link is emailed.
// ---------------------------------------------------------------------------
export async function forcePasswordResetAction(_prev: Result, formData: FormData): Promise<Result> {
  const g = await guard("adminEmailUser");
  if (!g.ok) return g.result;
  const id = parseId(formData);
  if (!id) return { status: "error", error: "notFound" };
  if (id === g.session.userId) return { status: "error", error: "selfAction" };

  const supabase = await createClient();
  const user = await getUser(supabase, id);
  if (!user) return { status: "error", error: "notFound" };
  // A deactivated account is banned: the emailed link could not be used.
  if (!user.isActive) return { status: "error", error: "userInactive" };

  const admin = createAdminClient();
  const unusable = `${randomBytes(48).toString("base64url")}Aa1`;
  const { error: pwError } = await admin.auth.admin.updateUserById(id, { password: unusable });
  if (pwError) {
    console.error(`[admin] forced password change failed: ${pwError.code ?? "unknown"}`);
    return { status: "error", error: "generic" };
  }
  const { error: revokeError } = await admin.rpc("revoke_user_sessions", { p_user: id });
  if (revokeError) console.error(`[admin] session revocation failed: ${revokeError.code}`);

  await audit({ actorId: g.session.userId, action: "user.password_reset.forced", targetType: "user", targetId: id });

  const url = await generateRecoveryLink(user.email, user.locale);
  if (!url) return { status: "error", error: "deliveryFailed" };
  const sent = await sendAuthLinkEmail({ kind: "passwordForced", to: user.email, locale: user.locale, name: user.fullName, url });
  return sent ? { status: "success" } : { status: "error", error: "deliveryFailed" };
}

// ---------------------------------------------------------------------------
// Upload access. Accounts register by themselves but can only upload once an
// administrator authorizes them, either directly (existing account) or by
// pre-authorizing an address that is applied when it is verified at sign-up.
// ---------------------------------------------------------------------------
async function setUploadAccess(formData: FormData, allowed: boolean): Promise<Result> {
  const g = await guard("adminGrantUser");
  if (!g.ok) return g.result;
  const id = parseId(formData);
  if (!id) return { status: "error", error: "notFound" };
  return applyUploadAccess(g.session.userId, id, allowed);
}

async function applyUploadAccess(adminId: string, id: string, allowed: boolean): Promise<Result> {
  const supabase = await createClient();
  const user = await getUser(supabase, id);
  if (!user || user.role !== "user") return { status: "error", error: "notFound" };
  if (user.canUpload === allowed) return { status: "success" };

  const { error } = await supabase.from("profiles").update({ can_upload: allowed }).eq("id", id);
  if (error) return { status: "error", error: profileErrorKey(error.message) };

  await audit({ actorId: adminId, action: allowed ? "user.upload.granted" : "user.upload.revoked", targetType: "user", targetId: id });
  if (allowed && user.isActive && !user.invitationPending) {
    after(async () => {
      try {
        await sendSecurityNotice({ kind: "uploadGranted", userId: id });
      } catch {
        console.error("[admin] upload access notice failed");
      }
    });
  }
  return { status: "success" };
}

export async function grantUploadAction(_prev: Result, formData: FormData): Promise<Result> {
  return setUploadAccess(formData, true);
}

export async function revokeUploadAction(_prev: Result, formData: FormData): Promise<Result> {
  return setUploadAccess(formData, false);
}

export type UploadGrantField = "email";
/** "granted": the address already had an account; "pending": applied when it signs up. */
export type UploadGrantState = FormState<UploadGrantField> & { outcome?: "granted" | "pending"; email?: string };

export async function preauthorizeUploadAction(_prev: UploadGrantState, formData: FormData): Promise<UploadGrantState> {
  const g = await guard("adminGrantUser");
  if (!g.ok) return g.result;

  const parsed = uploadGrantSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom<UploadGrantField>(parsed.error) };
  const { email } = parsed.data;

  const { data: userId } = await createAdminClient().rpc("auth_user_id_by_email", { p_email: email });
  if (userId) {
    const result = await applyUploadAccess(g.session.userId, userId, true);
    if (result.status === "error" && result.error === "notFound") return { status: "error", error: "uploadGrantAdmin" };
    return result.status === "success" ? { status: "success", outcome: "granted", email } : result;
  }

  const supabase = await createClient();
  const { error } = await supabase.from("upload_grants").insert({ email, granted_by: g.session.userId });
  if (error && error.code !== "23505") {
    console.error(`[admin] upload pre-authorization failed: ${error.code}`);
    return { status: "error", error: "generic" };
  }
  if (!error) {
    await audit({ actorId: g.session.userId, action: "user.upload.preauthorized", metadata: { email } });
  }
  return { status: "success", outcome: "pending", email };
}

export async function removePreauthorizationAction(_prev: Result, formData: FormData): Promise<Result> {
  const g = await guard("adminGrantUser");
  if (!g.ok) return g.result;
  const parsed = uploadGrantSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { status: "error", error: "notFound" };

  const supabase = await createClient();
  const { data, error } = await supabase.from("upload_grants").delete().eq("email", parsed.data.email).select("email");
  if (error) {
    console.error(`[admin] upload pre-authorization removal failed: ${error.code}`);
    return { status: "error", error: "generic" };
  }
  if (!data?.length) return { status: "error", error: "notFound" };

  await audit({ actorId: g.session.userId, action: "user.upload.preauthorization_removed", metadata: { email: parsed.data.email } });
  return { status: "success" };
}

// ---------------------------------------------------------------------------
// Storage quota
// ---------------------------------------------------------------------------
export type QuotaField = "quotaMb";

export async function updateQuotaAction(_prev: FormState<QuotaField>, formData: FormData): Promise<FormState<QuotaField>> {
  const g = await guard();
  if (!g.ok) return g.result;

  const parsed = quotaSchema.safeParse({ userId: formData.get("userId"), quotaMb: formData.get("quotaMb") });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom<QuotaField>(parsed.error) };

  const supabase = await createClient();
  const before = await getUser(supabase, parsed.data.userId);
  if (!before) return { status: "error", error: "notFound" };

  const bytes = parsed.data.quotaMb * MB;
  const { error } = await supabase.from("profiles").update({ storage_quota_bytes: bytes }).eq("id", parsed.data.userId);
  if (error) return { status: "error", error: profileErrorKey(error.message) };

  await audit({
    actorId: g.session.userId,
    action: "user.quota.changed",
    targetType: "user",
    targetId: parsed.data.userId,
    metadata: { from_bytes: before.quotaBytes, to_bytes: bytes },
  });
  return { status: "success" };
}

// ---------------------------------------------------------------------------
// Last four digits of the tax ID (used to match office records to accounts).
// ---------------------------------------------------------------------------
export type IdLast4Field = "idLast4";

export async function updateIdLast4Action(_prev: FormState<IdLast4Field>, formData: FormData): Promise<FormState<IdLast4Field>> {
  const g = await guard();
  if (!g.ok) return g.result;

  const parsed = idLast4Schema.safeParse({ userId: formData.get("userId"), idLast4: formData.get("idLast4") ?? "" });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom<IdLast4Field>(parsed.error) };

  const supabase = await createClient();
  const before = await getUser(supabase, parsed.data.userId);
  if (!before) return { status: "error", error: "notFound" };
  if (before.idLast4 === parsed.data.idLast4) return { status: "success" };

  const { error } = await supabase.from("profiles").update({ id_last4: parsed.data.idLast4 }).eq("id", parsed.data.userId);
  if (error) return { status: "error", error: profileErrorKey(error.message) };

  await audit({
    actorId: g.session.userId,
    action: "user.id_last4.changed",
    targetType: "user",
    targetId: parsed.data.userId,
    metadata: { from: before.idLast4, to: parsed.data.idLast4 },
  });
  return { status: "success" };
}

// ---------------------------------------------------------------------------
// Role change (step-up: the acting admin re-enters a current TOTP code).
// Self-changes and demoting the last active admin are refused (also enforced
// by the protect_profile_columns trigger). The target's sessions are revoked so
// the new role applies from a fresh sign-in; promoted users must enroll MFA.
// ---------------------------------------------------------------------------
export type RoleField = "code";

export async function changeRoleAction(_prev: FormState<RoleField>, formData: FormData): Promise<FormState<RoleField>> {
  const g = await guard();
  if (!g.ok) return g.result;
  const meta = await requestMeta();

  const parsed = roleChangeSchema.safeParse({ id: formData.get("id"), role: formData.get("role"), code: formData.get("code") });
  if (!parsed.success) {
    const fieldErrors = fieldErrorsFrom<RoleField>(parsed.error);
    return Object.keys(fieldErrors).length > 0 ? { status: "error", fieldErrors } : { status: "error", error: "notFound" };
  }
  const { id, role, code } = parsed.data;
  if (id === g.session.userId) return { status: "error", error: "selfAction" };
  if (!(await rateLimit("mfaUser", g.session.userId)).success) return { status: "error", error: "rateLimited" };

  const supabase = await createClient();
  const target = await getUser(supabase, id);
  if (!target) return { status: "error", error: "notFound" };
  if (!target.isActive || target.invitationPending) return { status: "error", error: "roleChangeUnavailable" };
  if (target.role === role) return { status: "success" };

  // Step-up verification of the acting administrator.
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const factor = factors?.totp.find((f) => f.status === "verified");
  if (!factor) return { status: "error", error: "mfaInvalid" };
  const { error: mfaError } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
  if (mfaError) {
    await audit({ actorId: g.session.userId, action: "auth.mfa.failed", targetType: "user", targetId: g.session.userId }, meta);
    return { status: "error", error: "mfaInvalid" };
  }

  const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
  if (error) return { status: "error", error: profileErrorKey(error.message) };

  const { error: revokeError } = await createAdminClient().rpc("revoke_user_sessions", { p_user: id });
  if (revokeError) console.error(`[admin] session revocation failed: ${revokeError.code}`);

  await audit({ actorId: g.session.userId, action: "user.role.changed", targetType: "user", targetId: id, metadata: { from: target.role, to: role } }, meta);
  after(async () => {
    try {
      await sendSecurityNotice({ kind: "roleChanged", userId: id, role });
    } catch {
      console.error("[admin] role notice failed");
    }
  });
  return { status: "success" };
}
