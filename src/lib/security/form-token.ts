import "server-only";
import { jwtVerify, SignJWT } from "jose";
import { serverEnv } from "@/lib/env";

/**
 * Time trap for public forms. The page embeds a signed token with the time it
 * was rendered; submissions that arrive faster than a human could type
 * (MIN_SECONDS) are treated as bots, and stale tokens ask for a reload.
 */
const MIN_SECONDS = 3;
const MAX_AGE_SECONDS = 2 * 60 * 60;

export type FormTokenCheck = "ok" | "tooFast" | "expired" | "invalid";

function key(): Uint8Array {
  return new TextEncoder().encode(serverEnv().SESSION_SECRET);
}

export async function issueFormToken(purpose: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(`form:${purpose}`)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(key());
}

export async function checkFormToken(token: FormDataEntryValue | null, purpose: string, now = Date.now()): Promise<FormTokenCheck> {
  if (typeof token !== "string" || token.length > 1000) return "invalid";
  try {
    const { payload } = await jwtVerify(token, key(), { audience: `form:${purpose}`, algorithms: ["HS256"], currentDate: new Date(now) });
    if (typeof payload.iat !== "number") return "invalid";
    return now / 1000 - payload.iat < MIN_SECONDS ? "tooFast" : "ok";
  } catch (error) {
    return error instanceof Error && "code" in error && error.code === "ERR_JWT_EXPIRED" ? "expired" : "invalid";
  }
}
