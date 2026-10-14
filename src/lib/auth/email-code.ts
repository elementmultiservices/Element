import "server-only";
import { randomInt, timingSafeEqual } from "node:crypto";
import { hashIdentifier } from "@/lib/security/hash";
import { redis } from "@/lib/security/rate-limit";

/**
 * One-time 6-digit codes sent by email to confirm a sensitive action while
 * signed in (e.g. creating a first password). Only a keyed hash is stored, in
 * Redis, bound to the user and the purpose; a code expires after
 * CODE_TTL_SECONDS, allows MAX_ATTEMPTS wrong guesses and works only once.
 * Requesting a new code replaces the previous one.
 */
type Purpose = "setPassword";
type Entry = { hash: string; attempts: number };

export const CODE_TTL_SECONDS = 10 * 60;
const MAX_ATTEMPTS = 5;

const key = (purpose: Purpose, userId: string) => `element:code:${purpose}:${userId}`;
const hashCode = (purpose: Purpose, userId: string, code: string) => hashIdentifier(`${purpose}:${userId}:${code}`);

// In-memory fallback for local development only (serverEnv() requires Upstash in production).
const memory = new Map<string, Entry & { expiresAt: number }>();

/** Creates and stores a new code, returning it for delivery (null if storage is unavailable). */
export async function issueEmailCode(purpose: Purpose, userId: string): Promise<string | null> {
  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const entry: Entry = { hash: hashCode(purpose, userId, code), attempts: 0 };
  const client = redis();
  try {
    if (client) await client.set(key(purpose, userId), entry, { ex: CODE_TTL_SECONDS });
    else memory.set(key(purpose, userId), { ...entry, expiresAt: Date.now() + CODE_TTL_SECONDS * 1000 });
    return code;
  } catch {
    console.error("[email-code] storage unavailable");
    return null;
  }
}

/** Checks a code and consumes it on success. Fails closed if storage is unavailable. */
export async function consumeEmailCode(purpose: Purpose, userId: string, code: string): Promise<boolean> {
  const k = key(purpose, userId);
  const client = redis();
  try {
    let entry: Entry | null;
    if (client) {
      entry = await client.get<Entry>(k);
    } else {
      const local = memory.get(k);
      entry = local && local.expiresAt > Date.now() ? local : null;
    }
    if (!entry) return false;

    const expected = Buffer.from(entry.hash);
    const given = Buffer.from(hashCode(purpose, userId, code));
    if (expected.length === given.length && timingSafeEqual(expected, given)) {
      // Single use: only the request that actually deletes the entry succeeds.
      if (client) return (await client.del(k)) === 1;
      return memory.delete(k);
    }

    const attempts = entry.attempts + 1;
    if (attempts >= MAX_ATTEMPTS) {
      if (client) await client.del(k);
      else memory.delete(k);
    } else if (client) {
      await client.set(k, { ...entry, attempts }, { keepTtl: true });
    } else {
      memory.set(k, { ...(memory.get(k) as Entry & { expiresAt: number }), attempts });
    }
    return false;
  } catch {
    console.error("[email-code] verification unavailable");
    return false;
  }
}
