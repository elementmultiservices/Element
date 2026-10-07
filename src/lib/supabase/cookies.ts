import type { CookieOptions } from "@supabase/ssr";

/**
 * Auth cookies are always HttpOnly, SameSite=Lax and Secure in production.
 * There is no browser Supabase client in this app, so JavaScript never needs
 * to read the session.
 */
export function hardenCookie(options: CookieOptions): CookieOptions {
  return {
    ...options,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}
