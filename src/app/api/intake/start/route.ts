import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, isAppLocale } from "@/i18n/routing";
import { authorize } from "@/lib/auth/session";
import { NEXT_TARGET_COOKIE, nextTargetCookieOptions, NEXT_TARGETS } from "@/lib/auth/next-target";

/**
 * Entry point of the public "Fill out the intake form" buttons. Signed-in
 * clients go straight to the form; everyone else signs in (or creates an
 * account) first and is brought back to the form afterwards.
 */
export async function GET(request: NextRequest) {
  const param = request.nextUrl.searchParams.get("locale");
  const locale = isAppLocale(param) ? param : defaultLocale;
  const go = (path: string) => {
    const response = NextResponse.redirect(new URL(`/${locale}${path}`, request.url), 303);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  };

  const auth = await authorize();
  if (auth.ok) return go(auth.ctx.role === "admin" ? "/admin/intake" : NEXT_TARGETS.intake);

  const response = go(auth.reason === "mfa_required" ? "/mfa" : "/sign-in?reason=intake");
  response.cookies.set(NEXT_TARGET_COOKIE, "intake", nextTargetCookieOptions);
  return response;
}
