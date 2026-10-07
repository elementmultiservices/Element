import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { serverEnv } from "@/lib/env";

type Duration = `${number} ${"s" | "m" | "h" | "d"}`;
type LimitConfig = { tokens: number; window: Duration };

/**
 * Central rate-limit catalogue. Each action is limited per IP and, where an
 * identity exists, per user/account. Later phases add upload and contact limits.
 */
export const LIMITS = {
  signInIp: { tokens: 20, window: "10 m" },
  passwordResetIp: { tokens: 5, window: "1 h" },
  passwordResetAccount: { tokens: 3, window: "1 h" },
  confirmLinkIp: { tokens: 20, window: "10 m" },
  mfaUser: { tokens: 10, window: "10 m" },
  passwordUpdateUser: { tokens: 10, window: "1 h" },
} as const satisfies Record<string, LimitConfig>;

export type LimitName = keyof typeof LIMITS;
export type LimitResult = { success: boolean; reset: number };

// Failed sign-in lockout: after LOCKOUT_THRESHOLD failures within the window,
// the account is locked for LOCKOUT_SECONDS. Keys are hashed identifiers.
export const LOCKOUT_THRESHOLD = 5;
export const LOCKOUT_SECONDS = 15 * 60;

const PREFIX = "element";

let redisClient: Redis | null | undefined;
function redis(): Redis | null {
  if (redisClient !== undefined) return redisClient;
  const env = serverEnv();
  redisClient =
    env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
      ? new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN })
      : null;
  return redisClient;
}

const limiters = new Map<LimitName, Ratelimit>();
function upstashLimiter(name: LimitName, client: Redis): Ratelimit {
  let limiter = limiters.get(name);
  if (!limiter) {
    const cfg = LIMITS[name];
    limiter = new Ratelimit({
      redis: client,
      limiter: Ratelimit.slidingWindow(cfg.tokens, cfg.window),
      prefix: `${PREFIX}:rl:${name}`,
      analytics: false,
    });
    limiters.set(name, limiter);
  }
  return limiter;
}

// ---------------------------------------------------------------------------
// In-memory fallback for local development only (serverEnv() requires Upstash
// in production). Fixed window, single process.
// ---------------------------------------------------------------------------
const memory = new Map<string, { count: number; resetAt: number }>();

function durationMs(window: Duration): number {
  const [amount, unit] = window.split(" ") as [string, "s" | "m" | "h" | "d"];
  const factor = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit];
  return Number(amount) * factor;
}

function memoryIncr(key: string, ttlMs: number): { count: number; resetAt: number } {
  const now = Date.now();
  const current = memory.get(key);
  if (!current || current.resetAt <= now) {
    const fresh = { count: 1, resetAt: now + ttlMs };
    memory.set(key, fresh);
    return fresh;
  }
  current.count += 1;
  return current;
}

export async function rateLimit(name: LimitName, identifier: string | null): Promise<LimitResult> {
  const id = identifier ?? "unknown";
  const client = redis();
  try {
    if (client) {
      const res = await upstashLimiter(name, client).limit(id);
      return { success: res.success, reset: res.reset };
    }
    const cfg = LIMITS[name];
    const entry = memoryIncr(`${name}:${id}`, durationMs(cfg.window));
    return { success: entry.count <= cfg.tokens, reset: entry.resetAt };
  } catch {
    // Fail closed: if the limiter is unavailable, deny the sensitive action.
    console.error(`[rate-limit] limiter unavailable for ${name}`);
    return { success: false, reset: Date.now() + 60_000 };
  }
}

// ---------------------------------------------------------------------------
// Account lockout counters
// ---------------------------------------------------------------------------
const lockKey = (scope: string, hashedId: string) => `${PREFIX}:lock:${scope}:${hashedId}`;

export async function isLockedOut(scope: string, hashedId: string): Promise<boolean> {
  const key = lockKey(scope, hashedId);
  const client = redis();
  try {
    if (client) {
      const count = (await client.get<number>(key)) ?? 0;
      return count >= LOCKOUT_THRESHOLD;
    }
    const entry = memory.get(key);
    return !!entry && entry.resetAt > Date.now() && entry.count >= LOCKOUT_THRESHOLD;
  } catch {
    console.error("[rate-limit] lockout check unavailable");
    return true;
  }
}

export async function registerFailure(scope: string, hashedId: string): Promise<number> {
  const key = lockKey(scope, hashedId);
  const client = redis();
  try {
    if (client) {
      const count = await client.incr(key);
      if (count === 1 || count === LOCKOUT_THRESHOLD) await client.expire(key, LOCKOUT_SECONDS);
      return count;
    }
    return memoryIncr(key, LOCKOUT_SECONDS * 1000).count;
  } catch {
    console.error("[rate-limit] failure counter unavailable");
    return LOCKOUT_THRESHOLD;
  }
}

export async function clearFailures(scope: string, hashedId: string): Promise<void> {
  const key = lockKey(scope, hashedId);
  const client = redis();
  try {
    if (client) await client.del(key);
    else memory.delete(key);
  } catch {
    console.error("[rate-limit] failure counter reset unavailable");
  }
}
