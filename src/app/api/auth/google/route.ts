import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, isAppLocale } from "@/i18n/routing";
import { rateLimit } from "@/lib/security/rate-limit";
import { clientIpFrom } from "@/lib/security/request-meta";
import { createRouteClient } from "@/lib/supabase/route";

/**
 * Starts "Continue with Google" (OAuth with PKCE). The verifier is stored in an
 * HttpOnly cookie and the browser is sent to Google through Supabase Auth.
 * Started by a plain link, so the CSP form-action rule is not involved.
 */
export async function GET(request: NextRequest) {
  const param = request.nextUrl.searchParams.get("locale");
  const locale = isAppLocale(param) ? param : defaultLocale;
  const signIn = (reason: string) => NextResponse.redirect(new URL(`/${locale}/sign-in?reason=${reason}`, request.url));

  if (!(await rateLimit("oauthIp", clientIpFrom(request.headers))).success) return signIn("oauth_failed");

  const { supabase, applyCookies } = createRouteClient(request);
  // The callback must be served by the same host (www or not) that holds the verifier cookie.
  const redirectTo = `${request.nextUrl.origin}/api/auth/callback?locale=${locale}`;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, skipBrowserRedirect: true, queryParams: { prompt: "select_account" } },
  });
  if (error || !data.url) {
    console.error(`[auth] google start failed: ${error?.code ?? "no_url"}`);
    return signIn("oauth_failed");
  }
  return applyCookies(NextResponse.redirect(data.url));
}
