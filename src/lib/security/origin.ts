import "server-only";
import type { NextRequest } from "next/server";

/**
 * CSRF defense for JSON route handlers: state-changing requests must come from
 * our own origin. (Server actions get the equivalent check from Next.js, and
 * auth cookies are SameSite=Lax.)
 */
export function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
