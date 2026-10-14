"use server";

import { after } from "next/server";
import { cookies } from "next/headers";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { isAppLocale, LOCALE_COOKIE, toLocale, type AppLocale } from "@/i18n/routing";
import { audit } from "@/lib/audit";
import { ACTIVITY_COOKIE, activityCookieOptions, signActivity } from "@/lib/auth/activity";
import { generateInviteLink, generateRecoveryLink } from "@/lib/auth/links";
import { consumeRecoveryCode, issueRecoveryCodes, resetMfaFactors } from "@/lib/auth/recovery-codes";
import { getSessionContext, homePathFor, requireSession } from "@/lib/auth/session";
import { sendAuthLinkEmail } from "@/lib/email/auth-emails";
import { notifyUploadGrantOnVerification, sendSecurityNotice } from "@/lib/email/security-emails";
import { serverEnv } from "@/lib/env";
import { fieldErrorsFrom, type FormState } from "@/lib/forms";
import { hashIdentifier } from "@/lib/security/hash";
import { clearFailures, isLockedOut, rateLimit, registerFailure } from "@/lib/security/rate-limit";
import { verifyRecaptcha } from "@/lib/security/recaptcha";
import { requestMeta } from "@/lib/security/request-meta";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  confirmLinkSchema,
  mfaVerifySchema,
  passwordResetRequestSchema,
  signInSchema,
  signUpSchema,
  updatePasswordSchema,
} from "@/lib/validation/auth";

const LOCKOUT_SCOPE = "signin";
const MIN_AUTH_RESPONSE_MS = 900;

/** Pads the response time so success, failure and unknown accounts are indistinguishable by timing. */
async function padResponse(startedAt: number): Promise<void> {
  const remaining = MIN_AUTH_RESPONSE_MS - (Date.now() - startedAt);
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
}

async function setLocaleCookie(locale: AppLocale): Promise<void> {
  (await cookies()).set(LOCALE_COOKIE, locale, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

async function startActivityWindow(userId: string, role: "user" | "admin"): Promise<void> {
  (await cookies()).set(ACTIVITY_COOKIE, await signActivity({ sub: userId, role }), activityCookieOptions(role));
}

// ---------------------------------------------------------------------------
// Sign in
// ---------------------------------------------------------------------------
export type SignInField = "email" | "password";

export async function signInAction(_prev: FormState<SignInField>, formData: FormData): Promise<FormState<SignInField>> {
  const startedAt = Date.now();
  const meta = await requestMeta();

  const parsed = signInSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom<SignInField>(parsed.error) };
  const { email, password } = parsed.data;

  if (!(await verifyRecaptcha(formData.get("recaptchaToken"), "sign_in", meta.ip))) {
    return { status: "error", error: "recaptchaFailed" };
  }
  if (!(await rateLimit("signInIp", meta.ip)).success) {
    return { status: "error", error: "rateLimited" };
  }

  const accountKey = hashIdentifier(email);
  const invalid: FormState<SignInField> = { status: "error", error: "invalidCredentials" };
  const admin = createAdminClient();

  const targetUserId = async (): Promise<string | undefined> => {
    const { data } = await admin.rpc("auth_user_id_by_email", { p_email: email });
    return data ?? undefined;
  };

  // Locked accounts receive exactly the same response as wrong credentials.
  if (await isLockedOut(LOCKOUT_SCOPE, accountKey)) {
    await audit({ actorId: null, action: "auth.sign_in.locked", targetType: "user", targetId: await targetUserId() }, meta);
    await padResponse(startedAt);
    return invalid;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    const failures = await registerFailure(LOCKOUT_SCOPE, accountKey);
    await audit(
      {
        actorId: null,
        action: "auth.sign_in.failure",
        targetType: "user",
        targetId: await targetUserId(),
        metadata: { reason: error?.code ?? "unknown", failures },
      },
      meta,
    );
    await padResponse(startedAt);
    return invalid;
  }

  const { data: ctx } = await supabase.rpc("session_context").maybeSingle();
  if (!ctx || !ctx.is_active) {
    await supabase.auth.signOut({ scope: "local" });
    await audit(
      { actorId: null, action: "auth.sign_in.failure", targetType: "user", targetId: data.user.id, metadata: { reason: "inactive" } },
      meta,
    );
    await padResponse(startedAt);
    return invalid;
  }

  await clearFailures(LOCKOUT_SCOPE, accountKey);
  await startActivityWindow(data.user.id, ctx.role);
  await setLocaleCookie(ctx.preferred_locale);
  await audit({ actorId: data.user.id, action: "auth.sign_in.success", targetType: "user", targetId: data.user.id }, meta);
  await padResponse(startedAt);

  const mfaRequired = ctx.role === "admin" || ctx.has_verified_mfa;
  return redirect({ href: mfaRequired ? "/mfa" : homePathFor(ctx.role), locale: ctx.preferred_locale });
}

// ---------------------------------------------------------------------------
// Password reset request (identical response whether or not the account exists)
// ---------------------------------------------------------------------------
export type ResetField = "email";

export async function requestPasswordResetAction(_prev: FormState<ResetField>, formData: FormData): Promise<FormState<ResetField>> {
  const startedAt = Date.now();
  const meta = await requestMeta();

  const parsed = passwordResetRequestSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom<ResetField>(parsed.error) };
  const { email } = parsed.data;

  if (!(await verifyRecaptcha(formData.get("recaptchaToken"), "password_reset", meta.ip))) {
    return { status: "error", error: "recaptchaFailed" };
  }
  if (!(await rateLimit("passwordResetIp", meta.ip)).success) {
    return { status: "error", error: "rateLimited" };
  }

  const accountAllowed = (await rateLimit("passwordResetAccount", hashIdentifier(email))).success;

  // Lookup, token generation and delivery happen after the response is sent,
  // so the response is the same for existing and non-existing accounts.
  if (accountAllowed) {
    after(async () => {
      try {
        const admin = createAdminClient();
        const { data: userId } = await admin.rpc("auth_user_id_by_email", { p_email: email });
        if (!userId) return;
        const { data: profile } = await admin
          .from("profiles")
          .select("full_name, is_active, preferred_locale")
          .eq("id", userId)
          .maybeSingle();
        if (!profile?.is_active) return;

        const url = await generateRecoveryLink(email, profile.preferred_locale);
        if (!url) return;
        await sendAuthLinkEmail({ kind: "passwordReset", to: email, locale: profile.preferred_locale, name: profile.full_name, url });
        await audit({ actorId: null, action: "auth.password_reset.requested", targetType: "user", targetId: userId }, meta);
      } catch {
        console.error("[auth] password reset delivery failed");
      }
    });
  }

  await padResponse(startedAt);
  return { status: "success" };
}

// ---------------------------------------------------------------------------
// Self-service sign-up (identical response whether or not the account exists).
// The account is created unconfirmed and the password is chosen only after the
// address is verified through the emailed link, so nobody can pre-register an
// address they do not control. New accounts cannot upload until an admin
// authorizes them (or pre-authorized the address).
// ---------------------------------------------------------------------------
export type SignUpField = "fullName" | "email" | "consent";

export async function signUpAction(_prev: FormState<SignUpField>, formData: FormData): Promise<FormState<SignUpField>> {
  const startedAt = Date.now();
  const meta = await requestMeta();
  const locale = toLocale(await getLocale());

  const parsed = signUpSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    consent: formData.get("consent"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom<SignUpField>(parsed.error) };
  const { fullName, email } = parsed.data;

  if (!(await verifyRecaptcha(formData.get("recaptchaToken"), "sign_up", meta.ip))) {
    return { status: "error", error: "recaptchaFailed" };
  }
  if (!(await rateLimit("signUpIp", meta.ip)).success) {
    return { status: "error", error: "rateLimited" };
  }

  const accountAllowed = (await rateLimit("signUpAccount", hashIdentifier(email))).success;

  if (accountAllowed) {
    after(async () => {
      try {
        const admin = createAdminClient();
        const { data: userId } = await admin.rpc("auth_user_id_by_email", { p_email: email });

        if (userId) {
          const [{ data: profile }, { data: existing }] = await Promise.all([
            admin.from("profiles").select("full_name, is_active, preferred_locale").eq("id", userId).maybeSingle(),
            admin.auth.admin.getUserById(userId),
          ]);
          if (!profile?.is_active) return;
          // Already verified: tell the owner instead of creating anything.
          if (existing.user?.email_confirmed_at) {
            const base = serverEnv().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
            await sendAuthLinkEmail({
              kind: "accountExists",
              to: email,
              locale: profile.preferred_locale,
              name: profile.full_name,
              url: `${base}/${profile.preferred_locale}/sign-in`,
            });
            await audit({ actorId: null, action: "auth.sign_up.existing", targetType: "user", targetId: userId }, meta);
            return;
          }
        }

        // New or still-unverified account: (re)issue the verification link.
        const link = await generateInviteLink({ email, fullName, locale });
        if ("error" in link) {
          console.error(`[auth] sign-up link failed: ${link.error}`);
          return;
        }
        await sendAuthLinkEmail({ kind: "signUp", to: email, locale, name: fullName, url: link.url });
        await audit({ actorId: null, action: "auth.sign_up.requested", targetType: "user", targetId: link.userId }, meta);
      } catch {
        console.error("[auth] sign-up delivery failed");
      }
    });
  }

  await padResponse(startedAt);
  return { status: "success" };
}

// ---------------------------------------------------------------------------
// Single-use link confirmation (recovery / invite). Requires an explicit POST so
// email link scanners that prefetch URLs cannot consume the token.
// ---------------------------------------------------------------------------
export async function confirmLinkAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const meta = await requestMeta();
  const locale = await getLocale();

  if (!(await rateLimit("confirmLinkIp", meta.ip)).success) return { status: "error", error: "rateLimited" };

  const parsed = confirmLinkSchema.safeParse({ tokenHash: formData.get("token_hash"), type: formData.get("type") });
  if (!parsed.success) return { status: "error", error: "linkInvalid" };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: parsed.data.tokenHash, type: parsed.data.type });
  if (error || !data.user) return { status: "error", error: "linkInvalid" };

  const { data: ctx } = await supabase.rpc("session_context").maybeSingle();
  if (!ctx || !ctx.is_active) {
    await supabase.auth.signOut({ scope: "local" });
    return { status: "error", error: "linkInvalid" };
  }

  await startActivityWindow(data.user.id, ctx.role);
  await audit(
    { actorId: data.user.id, action: "auth.link.verified", targetType: "user", targetId: data.user.id, metadata: { type: parsed.data.type } },
    meta,
  );
  // An invite link is the first verification of the address (admin invitation or self sign-up).
  if (parsed.data.type === "invite") {
    const userId = data.user.id;
    after(async () => {
      try {
        await notifyUploadGrantOnVerification(userId, meta);
      } catch {
        console.error("[auth] upload grant notice failed");
      }
    });
  }
  return redirect({ href: "/update-password", locale });
}

// ---------------------------------------------------------------------------
// Set / update password (after invite or recovery, or while signed in)
// ---------------------------------------------------------------------------
export type UpdatePasswordField = "password" | "confirmPassword";

export async function updatePasswordAction(
  _prev: FormState<UpdatePasswordField>,
  formData: FormData,
): Promise<FormState<UpdatePasswordField>> {
  const session = await requireSession();
  const meta = await requestMeta();

  const parsed = updatePasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom<UpdatePasswordField>(parsed.error) };

  if (!(await rateLimit("passwordUpdateUser", session.userId)).success) return { status: "error", error: "rateLimited" };

  const supabase = await createClient();
  // The first password of an invited or self-registered account is not a change worth notifying.
  const { data: hadPassword } = await supabase.rpc("my_has_password");
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") return { status: "error", error: "samePassword" };
    if (error.code === "weak_password") return { status: "error", error: "weakPassword" };
    console.error(`[auth] password update failed: ${error.code ?? "unknown"}`);
    return { status: "error", error: "generic" };
  }

  // Other sessions are revoked after a password change.
  await supabase.auth.signOut({ scope: "others" });
  await audit({ actorId: session.userId, action: "auth.password.updated", targetType: "user", targetId: session.userId }, meta);
  if (hadPassword === true) {
    after(async () => {
      try {
        await sendSecurityNotice({ kind: "passwordChanged", userId: session.userId, created: false });
      } catch {
        console.error("[auth] password notice failed");
      }
    });
  }

  const mfaRequired = session.role === "admin" || session.hasVerifiedMfa;
  const href = mfaRequired && session.aal !== "aal2" ? "/mfa" : homePathFor(session.role);
  return redirect({ href, locale: session.locale });
}

// ---------------------------------------------------------------------------
// MFA (TOTP)
// ---------------------------------------------------------------------------
export type MfaEnrollment = { ok: true; factorId: string; qrCode: string; secret: string } | { ok: false };

export async function startMfaEnrollmentAction(): Promise<MfaEnrollment> {
  const session = await requireSession();
  if (session.hasVerifiedMfa) return { ok: false };

  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  // Discard abandoned, never-verified factors before creating a new one.
  for (const factor of factors?.all ?? []) {
    if (factor.factor_type === "totp" && factor.status === "unverified") {
      await supabase.auth.mfa.unenroll({ factorId: factor.id });
    }
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    issuer: "Element",
    friendlyName: `Element ${crypto.randomUUID().slice(0, 8)}`,
  });
  if (error || !data) {
    console.error(`[auth] mfa enroll failed: ${error?.code ?? "unknown"}`);
    return { ok: false };
  }
  return { ok: true, factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

export type MfaField = "code";
/** On first enrollment the action returns the recovery codes (shown once) instead of redirecting. */
export type MfaState = FormState<MfaField> & { recoveryCodes?: string[]; next?: string };

export async function verifyMfaAction(_prev: MfaState, formData: FormData): Promise<MfaState> {
  const session = await requireSession();
  const meta = await requestMeta();

  const parsed = mfaVerifySchema.safeParse({
    code: formData.get("code"),
    factorId: formData.get("factorId") || undefined,
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom<MfaField>(parsed.error) };

  if (!(await rateLimit("mfaUser", session.userId)).success) return { status: "error", error: "rateLimited" };

  const supabase = await createClient();
  let factorId = parsed.data.factorId;
  const enrolling = !session.hasVerifiedMfa;
  if (!enrolling) {
    const { data: factors } = await supabase.auth.mfa.listFactors();
    factorId = factors?.totp.find((f) => f.status === "verified")?.id;
  }
  if (!factorId) return { status: "error", error: "mfaInvalid" };

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: parsed.data.code });
  if (error) {
    await audit({ actorId: session.userId, action: "auth.mfa.failed", targetType: "user", targetId: session.userId }, meta);
    return { status: "error", error: "mfaInvalid" };
  }

  await startActivityWindow(session.userId, session.role);
  await audit(
    { actorId: session.userId, action: enrolling ? "auth.mfa.enrolled" : "auth.mfa.verified", targetType: "user", targetId: session.userId },
    meta,
  );
  if (enrolling) {
    const recoveryCodes = await issueRecoveryCodes(session.userId);
    return { status: "success", recoveryCodes, next: homePathFor(session.role) };
  }
  return redirect({ href: homePathFor(session.role), locale: session.locale });
}

// ---------------------------------------------------------------------------
// MFA recovery code: resets two-step verification (all factors are removed,
// which revokes every session) and asks the user to sign in again. Admins then
// have to enroll a new authenticator before reaching the panel.
// ---------------------------------------------------------------------------
export type RecoveryField = "recoveryCode";
const RECOVERY_SCOPE = "mfa-recovery";

export async function redeemRecoveryCodeAction(_prev: FormState<RecoveryField>, formData: FormData): Promise<FormState<RecoveryField>> {
  const session = await requireSession();
  const meta = await requestMeta();
  const raw = formData.get("recoveryCode");
  if (typeof raw !== "string" || raw.trim() === "") return { status: "error", fieldErrors: { recoveryCode: "required" } };
  if (!session.hasVerifiedMfa) return { status: "error", error: "recoveryInvalid" };

  const key = hashIdentifier(session.userId);
  if (!(await rateLimit("mfaUser", session.userId)).success || (await isLockedOut(RECOVERY_SCOPE, key))) {
    return { status: "error", error: "rateLimited" };
  }

  if (!(await consumeRecoveryCode(session.userId, raw))) {
    await registerFailure(RECOVERY_SCOPE, key);
    await audit({ actorId: session.userId, action: "auth.mfa.recovery_failed", targetType: "user", targetId: session.userId }, meta);
    return { status: "error", error: "recoveryInvalid" };
  }

  await clearFailures(RECOVERY_SCOPE, key);
  const reset = await resetMfaFactors(session.userId);
  if (!reset) {
    console.error("[mfa] factor reset failed");
    return { status: "error", error: "generic" };
  }
  await audit({ actorId: session.userId, action: "auth.mfa.recovery_used", targetType: "user", targetId: session.userId }, meta);

  after(async () => {
    try {
      await sendSecurityNotice({ kind: "recoveryUsed", userId: session.userId });
    } catch {
      console.error("[mfa] recovery notice failed");
    }
  });

  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  (await cookies()).delete(ACTIVITY_COOKIE);
  return redirect({ href: { pathname: "/sign-in", query: { reason: "mfa_reset" } }, locale: session.locale });
}

// ---------------------------------------------------------------------------
// Sign out
// ---------------------------------------------------------------------------
export async function signOutAction(): Promise<never> {
  const locale = await getLocale();
  const session = await getSessionContext();
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  (await cookies()).delete(ACTIVITY_COOKIE);
  if (session) {
    await audit({ actorId: session.userId, action: "auth.sign_out", targetType: "user", targetId: session.userId });
  }
  return redirect({ href: "/sign-in", locale });
}

// ---------------------------------------------------------------------------
// Language preference (cookie + profile for signed-in users)
// ---------------------------------------------------------------------------
export async function setPreferredLocaleAction(locale: string): Promise<void> {
  if (!isAppLocale(locale)) return;
  await setLocaleCookie(locale);
  const session = await getSessionContext();
  if (session && session.isActive) {
    const supabase = await createClient();
    const { error } = await supabase.from("profiles").update({ preferred_locale: locale }).eq("id", session.userId);
    if (error) console.error(`[profile] locale update failed: ${error.code}`);
  }
}
