import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { serverEnv } from "@/lib/env";

/**
 * Inactivity timeout, enforced by a signed HttpOnly cookie that the proxy
 * re-issues on every navigation. Its expiry equals the role's idle limit, so a
 * missing, tampered or expired cookie means the session ended.
 */
export const ACTIVITY_COOKIE = "el_activity";

export type ActivityRole = "user" | "admin";

export const IDLE_TIMEOUT_SECONDS: Record<ActivityRole, number> = {
  admin: 30 * 60,
  user: 8 * 60 * 60,
};

export type ActivityPayload = { sub: string; role: ActivityRole };

const ISSUER = "element";
const AUDIENCE = "element:activity";

function key(): Uint8Array {
  return new TextEncoder().encode(serverEnv().SESSION_SECRET);
}

export async function signActivity(payload: ActivityPayload): Promise<string> {
  const ttl = IDLE_TIMEOUT_SECONDS[payload.role];
  return new SignJWT({ role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .sign(key());
}

export async function readActivity(token: string | undefined): Promise<ActivityPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { issuer: ISSUER, audience: AUDIENCE, algorithms: ["HS256"] });
    const role = payload.role;
    if (typeof payload.sub !== "string" || (role !== "user" && role !== "admin")) return null;
    return { sub: payload.sub, role };
  } catch {
    return null;
  }
}

export function activityCookieOptions(role: ActivityRole) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: IDLE_TIMEOUT_SECONDS[role],
  };
}
