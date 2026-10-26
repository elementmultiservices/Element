import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, isAppLocale } from "@/i18n/routing";
import { authorize } from "@/lib/auth/session";
import { NEXT_TARGET_COOKIE, nextTargetCookieOptions, NEXT_TARGETS } from "@/lib/auth/next-target";

/**
 * Entry point of the public "Fill out the intake form" buttons. Signed-in
 * clients go to the form in their account (it is theirs right away); everyone
 * else fills out the public form, which staff assign to an account afterwards.
 * A session still waiting for its second factor finishes signing in first.
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
  if (auth.reason !== "mfa_required") return go("/intake");

  const response = go("/mfa");
  response.cookies.set(NEXT_TARGET_COOKIE, "intake", nextTargetCookieOptions);
  return response;
}
