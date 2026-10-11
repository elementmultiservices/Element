import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { isAppLocale, type AppLocale } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import { ACTIVITY_COOKIE, readActivity } from "./activity";

export type Role = "user" | "admin";

export type SessionContext = {
  userId: string;
  email: string | null;
  role: Role;
  isActive: boolean;
  locale: AppLocale;
  fullName: string;
  hasVerifiedMfa: boolean;
  aal: "aal1" | "aal2";
  /** Granted by an administrator; admins always upload on behalf of users. */
  canUpload: boolean;
};

/**
 * Resolves the current session on the server. The JWT is verified by Supabase
 * (getClaims), and role / active status / MFA state are read fresh from the
 * database on every request. Cached per request.
 */
export const getSessionContext = cache(async (): Promise<SessionContext | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;

  // Inactivity rule: the activity cookie must exist, be valid and match the user.
  const activity = await readActivity((await cookies()).get(ACTIVITY_COOKIE)?.value);
  if (!activity || activity.sub !== claims.sub) return null;

  const { data: ctx, error: ctxError } = await supabase.rpc("session_context").maybeSingle();
  if (ctxError || !ctx || !ctx.session_valid) return null;

  return {
    userId: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    role: ctx.role,
    isActive: ctx.is_active,
    locale: isAppLocale(ctx.preferred_locale) ? ctx.preferred_locale : "en",
    fullName: ctx.full_name,
    hasVerifiedMfa: ctx.has_verified_mfa,
    aal: claims.aal === "aal2" ? "aal2" : "aal1",
    canUpload: ctx.can_upload,
  };
});

export type AuthorizationFailure = "unauthenticated" | "inactive" | "mfa_required" | "forbidden";

export type Authorization =
  | { ok: true; ctx: SessionContext }
  | { ok: false; reason: AuthorizationFailure };

/** Non-redirecting check for route handlers and server actions. */
export async function authorize(options: { role?: Role } = {}): Promise<Authorization> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, reason: "unauthenticated" };
  if (!ctx.isActive) return { ok: false, reason: "inactive" };
  const mfaRequired = ctx.role === "admin" || ctx.hasVerifiedMfa;
  if (mfaRequired && ctx.aal !== "aal2") return { ok: false, reason: "mfa_required" };
  if (options.role === "admin" && ctx.role !== "admin") return { ok: false, reason: "forbidden" };
  return { ok: true, ctx };
}

async function redirectForFailure(reason: AuthorizationFailure): Promise<never> {
  const locale = await getLocale();
  switch (reason) {
    case "mfa_required":
      return redirect({ href: "/mfa", locale });
    case "forbidden":
      return notFound();
    default:
      return redirect({ href: { pathname: "/sign-in", query: { reason: "session_ended" } }, locale });
  }
}

/** For pages, layouts and server actions of the user dashboard. */
export async function requireUser(): Promise<SessionContext> {
  const result = await authorize();
  if (!result.ok) return redirectForFailure(result.reason);
  return result.ctx;
}

/** For pages, layouts and server actions of the admin panel. */
export async function requireAdmin(): Promise<SessionContext> {
  const result = await authorize({ role: "admin" });
  if (!result.ok) return redirectForFailure(result.reason);
  return result.ctx;
}

/** Signed-in session regardless of MFA level (used by the MFA and set-password pages). */
export async function requireSession(): Promise<SessionContext> {
  const ctx = await getSessionContext();
  if (!ctx || !ctx.isActive) return redirectForFailure("unauthenticated");
  return ctx;
}

export function homePathFor(role: Role): "/admin" | "/dashboard" {
  return role === "admin" ? "/admin" : "/dashboard";
}
