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

/**
 * Public intake form ("draft"). The token carries a random draft id that ties
 * the visitor's pending documents to the form they are filling out (there is no
 * account), lasts a day like those documents, and is a time trap of its own: a
 * person needs minutes, not seconds, to answer the package.
 */
// Outside the "form:" audiences so a draft is never accepted as another form's token.
const DRAFT_PURPOSE = "intake:draft";
const DRAFT_MIN_SECONDS = 60;
const DRAFT_MAX_AGE_SECONDS = 24 * 60 * 60;

export type DraftTokenCheck = { status: FormTokenCheck; draftId: string | null };

export async function issueDraftToken(): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(DRAFT_PURPOSE)
    .setSubject(crypto.randomUUID())
    .setIssuedAt()
    .setExpirationTime(`${DRAFT_MAX_AGE_SECONDS}s`)
    .sign(key());
}

export async function checkDraftToken(token: string | null, now = Date.now()): Promise<DraftTokenCheck> {
  if (typeof token !== "string" || token.length > 1000) return { status: "invalid", draftId: null };
  try {
    const { payload } = await jwtVerify(token, key(), { audience: DRAFT_PURPOSE, algorithms: ["HS256"], currentDate: new Date(now) });
    const draftId = typeof payload.sub === "string" && /^[0-9a-f-]{36}$/.test(payload.sub) ? payload.sub : null;
    if (typeof payload.iat !== "number" || !draftId) return { status: "invalid", draftId: null };
    return { status: now / 1000 - payload.iat < DRAFT_MIN_SECONDS ? "tooFast" : "ok", draftId };
  } catch (error) {
    const expired = error instanceof Error && "code" in error && error.code === "ERR_JWT_EXPIRED";
    return { status: expired ? "expired" : "invalid", draftId: null };
  }
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
