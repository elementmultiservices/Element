import { NextResponse, type NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { createServerClient } from "@supabase/ssr";
import { defaultLocale, isAppLocale, LOCALE_COOKIE, routing, type AppLocale } from "@/i18n/routing";
import { hardenCookie } from "@/lib/supabase/cookies";
import { ACTIVITY_COOKIE, activityCookieOptions, readActivity, signActivity, type ActivityRole } from "@/lib/auth/activity";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Request pipeline (first line of defense; every server action and route
 * handler re-checks authorization on its own):
 *   1. Locale resolution (explicit cookie choice only; default English).
 *   2. Supabase session refresh + JWT verification.
 *   3. Inactivity timeout (30 min admin / 8 h user).
 *   4. Active account, MFA (aal2) and role checks for protected areas.
 */

const intl = createIntlMiddleware(routing);

type Area = "dashboard" | "admin" | "session" | "guest" | "public";

function classify(path: string): Area {
  if (/^\/dashboard(\/|$)/.test(path)) return "dashboard";
  if (/^\/admin(\/|$)/.test(path)) return "admin";
  if (/^\/(mfa|update-password)(\/|$)/.test(path)) return "session";
  if (/^\/(sign-in|reset-password)(\/|$)/.test(path)) return "guest";
  return "public";
}

function splitLocale(pathname: string): { locale: AppLocale | null; path: string } {
  const match = /^\/([a-z]{2})(\/.*)?$/.exec(pathname);
  if (match && isAppLocale(match[1])) return { locale: match[1], path: match[2] ?? "/" };
  return { locale: null, path: pathname };
}

function preferredLocale(request: NextRequest): AppLocale {
  const value = request.cookies.get(LOCALE_COOKIE)?.value;
  return isAppLocale(value) ? value : defaultLocale;
}

/** Redirect that carries over any cookies (e.g. cleared session) set on `base`. */
function redirectWith(request: NextRequest, target: string, base: NextResponse): NextResponse {
  const res = NextResponse.redirect(new URL(target, request.url));
  for (const cookie of base.cookies.getAll()) res.cookies.set(cookie);
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

function jsonWith(status: number, error: string, base: NextResponse): NextResponse {
  const res = NextResponse.json({ error }, { status });
  for (const cookie of base.cookies.getAll()) res.cookies.set(cookie);
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith("/api/");

  // 1. Locale ---------------------------------------------------------------
  let locale: AppLocale = defaultLocale;
  let path = pathname;
  if (!isApi) {
    const split = splitLocale(pathname);
    if (!split.locale) {
      const target = `/${preferredLocale(request)}${pathname === "/" ? "" : pathname}${request.nextUrl.search}`;
      return NextResponse.redirect(new URL(target, request.url));
    }
    locale = split.locale;
    path = split.path;
  }

  const response = isApi ? NextResponse.next({ request }) : intl(request);
  if (response.headers.has("location")) return response;

  // 2. Session ---------------------------------------------------------------
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, hardenCookie(options));
          }
          for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
        },
      },
    },
  );

  const area: Area = isApi ? "public" : classify(path);
  const needsSession = isApi ? false : area === "dashboard" || area === "admin" || area === "session";
  const signInUrl = (reason?: string) => `/${locale}/sign-in${reason ? `?reason=${reason}` : ""}`;

  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  const userId = claims?.sub;

  if (!userId) {
    if (request.cookies.has(ACTIVITY_COOKIE)) response.cookies.delete(ACTIVITY_COOKIE);
    if (needsSession) return redirectWith(request, signInUrl(), response);
    return response;
  }

  // Ends the session server-side and clears cookies.
  const endSession = async (): Promise<NextResponse> => {
    await supabase.auth.signOut({ scope: "local" });
    response.cookies.delete(ACTIVITY_COOKIE);
    if (isApi) return jsonWith(401, "unauthorized", response);
    if (area === "public") return redirectWith(request, `${pathname}${request.nextUrl.search}`, response);
    return redirectWith(request, signInUrl("session_ended"), response);
  };

  // 3. Inactivity ------------------------------------------------------------
  const activity = await readActivity(request.cookies.get(ACTIVITY_COOKIE)?.value);
  if (!activity || activity.sub !== userId) return endSession();

  let role: ActivityRole = activity.role;

  // 4. Account state, MFA and role (fresh from the database) ------------------
  if (area !== "public" || isApi) {
    const { data: ctx, error } = await supabase.rpc("session_context").maybeSingle();
    if (error || !ctx || !ctx.is_active || !ctx.session_valid) return endSession();
    role = ctx.role;

    const aal = claims?.aal === "aal2" ? "aal2" : "aal1";
    const mfaRequired = ctx.role === "admin" || ctx.has_verified_mfa;
    const home = ctx.role === "admin" ? "/admin" : "/dashboard";

    if (!isApi) {
      if (mfaRequired && aal !== "aal2" && (area === "dashboard" || area === "admin" || area === "guest")) {
        return redirectWith(request, `/${locale}/mfa`, response);
      }
      if (area === "admin" && ctx.role !== "admin") return redirectWith(request, `/${locale}/dashboard`, response);
      if (area === "dashboard" && ctx.role === "admin") return redirectWith(request, `/${locale}/admin`, response);
      if (area === "guest") return redirectWith(request, `/${locale}${home}`, response);
    } else if (mfaRequired && aal !== "aal2") {
      return jsonWith(403, "mfa_required", response);
    }
  }

  // Sliding inactivity window: prefetches do not count as user activity.
  if (request.headers.get("next-router-prefetch") !== "1") {
    response.cookies.set(ACTIVITY_COOKIE, await signActivity({ sub: userId, role }), activityCookieOptions(role));
  }

  return response;
}

export const config = {
  // Everything except Next internals and static files (paths with a dot).
  matcher: ["/((?!_next|_vercel|monitoring|.*\\..*).*)"],
};
