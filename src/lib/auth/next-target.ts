import "server-only";
import { cookies } from "next/headers";
import type { Role } from "./session";

/**
 * Where to send a client after signing in, when they started from a public
 * call to action (e.g. "Fill out the intake form"). Only named targets from
 * this allowlist exist, so the cookie can never become an open redirect.
 */
export const NEXT_TARGET_COOKIE = "element_next";
export const NEXT_TARGETS = { intake: "/dashboard/intake/new" } as const;
export type NextTarget = keyof typeof NEXT_TARGETS;

export const nextTargetCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 30 * 60,
};

export function nextTargetPath(value: string | undefined, role: Role): string | null {
  if (role !== "user" || !value || !Object.hasOwn(NEXT_TARGETS, value)) return null;
  return NEXT_TARGETS[value as NextTarget];
}

/** Reads and clears the pending target (server actions only). */
export async function consumeNextTarget(role: Role): Promise<string | null> {
  const jar = await cookies();
  const value = jar.get(NEXT_TARGET_COOKIE)?.value;
  if (value === undefined) return null;
  jar.delete(NEXT_TARGET_COOKIE);
  return nextTargetPath(value, role);
}
