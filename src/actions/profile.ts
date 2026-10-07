"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "@/i18n/navigation";
import { LOCALE_COOKIE } from "@/i18n/routing";
import { audit } from "@/lib/audit";
import { homePathFor, requireUser } from "@/lib/auth/session";
import { serverEnv } from "@/lib/env";
import { fieldErrorsFrom, type FormState } from "@/lib/forms";
import { hashIdentifier } from "@/lib/security/hash";
import { isLockedOut, rateLimit, registerFailure } from "@/lib/security/rate-limit";
import { requestMeta } from "@/lib/security/request-meta";
import { createClient } from "@/lib/supabase/server";
import { localeSchema, mfaVerifySchema, updatePasswordSchema } from "@/lib/validation/auth";
import { profileNameSchema } from "@/lib/validation/files";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Name
// ---------------------------------------------------------------------------
export type NameField = "fullName";

export async function updateNameAction(_prev: FormState<NameField>, formData: FormData): Promise<FormState<NameField>> {
  const session = await requireUser();
  const parsed = profileNameSchema.safeParse({ fullName: formData.get("fullName") });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom<NameField>(parsed.error) };
  if (!(await rateLimit("profileUpdateUser", session.userId)).success) return { status: "error", error: "rateLimited" };

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ full_name: parsed.data.fullName }).eq("id", session.userId);
  if (error) {
    console.error(`[profile] name update failed: ${error.code}`);
    return { status: "error", error: "generic" };
  }
  await audit({ actorId: session.userId, action: "user.profile.updated", targetType: "user", targetId: session.userId, metadata: { fields: ["full_name"] } });
  return { status: "success" };
}

// ---------------------------------------------------------------------------
// Preferred language (interface + emails)
// ---------------------------------------------------------------------------
export async function updateLocaleAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireUser();
  const parsed = localeSchema.safeParse(formData.get("locale"));
  if (!parsed.success) return { status: "error", error: "generic" };

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ preferred_locale: parsed.data }).eq("id", session.userId);
  if (error) {
    console.error(`[profile] locale update failed: ${error.code}`);
    return { status: "error", error: "generic" };
  }
  (await cookies()).set(LOCALE_COOKIE, parsed.data, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  await audit({ actorId: session.userId, action: "user.profile.updated", targetType: "user", targetId: session.userId, metadata: { fields: ["preferred_locale"] } });
  return redirect({ href: `${homePathFor(session.role)}/profile`, locale: parsed.data });
}

// ---------------------------------------------------------------------------
// Password (requires the current password)
// ---------------------------------------------------------------------------
export type ChangePasswordField = "currentPassword" | "password" | "confirmPassword";

const changePasswordSchema = z
  .object({ currentPassword: z.string({ error: "required" }).min(1, { error: "required" }).max(128, { error: "passwordMax" }) })
  .and(updatePasswordSchema);

export async function changePasswordAction(
  _prev: FormState<ChangePasswordField>,
  formData: FormData,
): Promise<FormState<ChangePasswordField>> {
  const session = await requireUser();
  const meta = await requestMeta();
  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom<ChangePasswordField>(parsed.error) };
  if (!session.email) return { status: "error", error: "generic" };
  if (!(await rateLimit("passwordUpdateUser", session.userId)).success) return { status: "error", error: "rateLimited" };

  // Failed current-password checks count toward the same lockout as sign-in.
  const accountKey = hashIdentifier(session.email);
  if (await isLockedOut("signin", accountKey)) return { status: "error", error: "rateLimited" };

  // Verify the current password with an isolated, non-persistent client so the
  // user's own session cookies are untouched.
  const env = serverEnv();
  const verifier = createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error: verifyError } = await verifier.auth.signInWithPassword({ email: session.email, password: parsed.data.currentPassword });
  if (verifyError) {
    await registerFailure("signin", accountKey);
    return { status: "error", fieldErrors: {}, error: "currentPasswordInvalid" };
  }
  await verifier.auth.signOut({ scope: "local" });

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") return { status: "error", error: "samePassword" };
    if (error.code === "weak_password") return { status: "error", error: "weakPassword" };
    console.error(`[profile] password update failed: ${error.code ?? "unknown"}`);
    return { status: "error", error: "generic" };
  }
  await supabase.auth.signOut({ scope: "others" });
  await audit({ actorId: session.userId, action: "auth.password.updated", targetType: "user", targetId: session.userId }, meta);
  return { status: "success" };
}

// ---------------------------------------------------------------------------
// Disable optional MFA (regular users only; mandatory for admins)
// ---------------------------------------------------------------------------
export type DisableMfaField = "code";

export async function disableMfaAction(_prev: FormState<DisableMfaField>, formData: FormData): Promise<FormState<DisableMfaField>> {
  const session = await requireUser();
  if (session.role === "admin" || !session.hasVerifiedMfa || session.aal !== "aal2") return { status: "error", error: "generic" };

  const parsed = mfaVerifySchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom<DisableMfaField>(parsed.error) };
  if (!(await rateLimit("mfaUser", session.userId)).success) return { status: "error", error: "rateLimited" };

  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const factor = factors?.totp.find((f) => f.status === "verified");
  if (!factor) return { status: "error", error: "generic" };

  const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: parsed.data.code });
  if (verifyError) {
    await audit({ actorId: session.userId, action: "auth.mfa.failed", targetType: "user", targetId: session.userId });
    return { status: "error", error: "mfaInvalid" };
  }
  const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
  if (error) {
    console.error(`[profile] mfa unenroll failed: ${error.code ?? "unknown"}`);
    return { status: "error", error: "generic" };
  }
  await audit({ actorId: session.userId, action: "auth.mfa.disabled", targetType: "user", targetId: session.userId });
  return { status: "success" };
}
