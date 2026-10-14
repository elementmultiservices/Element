import { after, NextResponse, type NextRequest } from "next/server";
import { defaultLocale, isAppLocale, LOCALE_COOKIE } from "@/i18n/routing";
import { audit } from "@/lib/audit";
import { ACTIVITY_COOKIE, activityCookieOptions, signActivity } from "@/lib/auth/activity";
import { notifyUploadGrantOnVerification } from "@/lib/email/security-emails";
import { requestMeta } from "@/lib/security/request-meta";
import { createRouteClient } from "@/lib/supabase/route";

/** Accounts created this recently are treated as new sign-ups (language taken from the page they used). */
const NEW_ACCOUNT_WINDOW_MS = 10 * 60 * 1000;

/**
 * Google sign-in callback: exchanges the one-time code (PKCE) for a session,
 * then applies the same checks and cookies as a password sign-in. New accounts
 * are regular users without upload access unless the address was pre-authorized.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const param = params.get("locale");
  let locale = isAppLocale(param) ? param : defaultLocale;
  const meta = await requestMeta();
  const { supabase, applyCookies } = createRouteClient(request);
  const go = (path: string) => applyCookies(NextResponse.redirect(new URL(path, request.url)));
  const failed = () => go(`/${locale}/sign-in?reason=oauth_failed`);

  const code = params.get("code");
  if (!code) return failed();

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    console.error(`[auth] google callback failed: ${error?.code ?? "no_user"}`);
    return failed();
  }
  const user = data.user;

  const { data: ctx } = await supabase.rpc("session_context").maybeSingle();
  if (!ctx || !ctx.is_active) {
    await supabase.auth.signOut({ scope: "local" });
    await audit(
      { actorId: null, action: "auth.sign_in.failure", targetType: "user", targetId: user.id, metadata: { reason: "inactive", method: "google" } },
      meta,
    );
    return failed();
  }

  const isNew = Date.now() - new Date(user.created_at).getTime() < NEW_ACCOUNT_WINDOW_MS;
  if (isNew) {
    if (ctx.preferred_locale !== locale) {
      const { error: localeError } = await supabase.from("profiles").update({ preferred_locale: locale }).eq("id", user.id);
      if (localeError) console.error(`[auth] new account locale update failed: ${localeError.code}`);
    }
  } else {
    locale = ctx.preferred_locale;
  }

  // Google verified the address just now (new account, or an unverified sign-up
  // completed with Google): tell the owner about upload access granted before.
  const confirmedAt = user.email_confirmed_at ? new Date(user.email_confirmed_at).getTime() : 0;
  if (Date.now() - confirmedAt < NEW_ACCOUNT_WINDOW_MS) {
    after(async () => {
      try {
        await notifyUploadGrantOnVerification(user.id, meta);
      } catch {
        console.error("[auth] upload grant notice failed");
      }
    });
  }

  await audit(
    { actorId: user.id, action: "auth.sign_in.success", targetType: "user", targetId: user.id, metadata: { method: "google", new_account: isNew } },
    meta,
  );

  const mfaRequired = ctx.role === "admin" || ctx.has_verified_mfa;
  const home = ctx.role === "admin" ? "/admin" : "/dashboard";
  const response = go(`/${locale}${mfaRequired ? "/mfa" : home}`);
  response.cookies.set(ACTIVITY_COOKIE, await signActivity({ sub: user.id, role: ctx.role }), activityCookieOptions(ctx.role));
  response.cookies.set(LOCALE_COOKIE, locale, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
