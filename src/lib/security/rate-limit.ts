import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { serverEnv } from "@/lib/env";
import { DAILY_UPLOAD_CAP } from "@/lib/files/rules";

type Duration = `${number} ${"s" | "m" | "h" | "d"}`;
type LimitConfig = { tokens: number; window: Duration };

/**
 * Central rate-limit catalogue. Each action is limited per IP and, where an
 * identity exists, per user/account. 
 */
export const LIMITS = {
  signInIp: { tokens: 20, window: "10 m" },
  passwordResetIp: { tokens: 5, window: "1 h" },
  passwordResetAccount: { tokens: 3, window: "1 h" },
  signUpIp: { tokens: 5, window: "1 h" },
  signUpAccount: { tokens: 3, window: "1 h" },
  oauthIp: { tokens: 30, window: "10 m" },
  confirmLinkIp: { tokens: 20, window: "10 m" },
  mfaUser: { tokens: 10, window: "10 m" },
  passwordUpdateUser: { tokens: 10, window: "1 h" },
  passwordCodeUser: { tokens: 5, window: "1 h" },
  profileUpdateUser: { tokens: 30, window: "1 h" },
  uploadIntentUser: { tokens: 20, window: "10 m" },
  uploadIntentIp: { tokens: 60, window: "10 m" },
  uploadDailyUser: { tokens: DAILY_UPLOAD_CAP, window: "1 d" },
  uploadConfirmUser: { tokens: 30, window: "10 m" },
  downloadUser: { tokens: 120, window: "10 m" },
  downloadIp: { tokens: 300, window: "10 m" },
  uploadDailyAdmin: { tokens: 1000, window: "1 d" },
  adminActionUser: { tokens: 200, window: "10 m" },
  adminInviteUser: { tokens: 30, window: "1 h" },
  adminEmailUser: { tokens: 60, window: "1 h" },
  adminGrantUser: { tokens: 100, window: "1 h" },
  adminExportUser: { tokens: 30, window: "10 m" },
  contactIp: { tokens: 5, window: "1 h" },
  contactEmail: { tokens: 3, window: "1 h" },
  contactAckRecipient: { tokens: 1, window: "1 d" },
  contactAckGlobal: { tokens: 200, window: "1 d" },
  newsletterIp: { tokens: 10, window: "1 h" },
  newsletterEmail: { tokens: 3, window: "1 h" },
  newsletterUnsubscribeIp: { tokens: 30, window: "10 m" },
  newsletterSendUser: { tokens: 10, window: "1 h" },
  coverUploadUser: { tokens: 30, window: "10 m" },
  intakeUploadUser: { tokens: 60, window: "10 m" },
  intakeUploadDailyUser: { tokens: 150, window: "1 d" },
  intakeSubmitUser: { tokens: 5, window: "1 h" },
  // Public (no account) intake form: stricter, per IP and per typed email.
  intakePublicUploadIp: { tokens: 40, window: "10 m" },
  intakePublicUploadDailyIp: { tokens: 60, window: "1 d" },
  intakePublicSubmitIp: { tokens: 3, window: "1 h" },
  intakePublicSubmitDailyIp: { tokens: 6, window: "1 d" },
  intakePublicSubmitEmail: { tokens: 2, window: "1 d" },
  adminIntakeAssignUser: { tokens: 60, window: "1 h" },
  intakePdfUser: { tokens: 60, window: "10 m" },
} as const satisfies Record<string, LimitConfig>;

export type LimitName = keyof typeof LIMITS;
export type LimitResult = { success: boolean; reset: number };

// Failed sign-in lockout: after LOCKOUT_THRESHOLD failures within the window,
// the account is locked for LOCKOUT_SECONDS. Keys are hashed identifiers.
export const LOCKOUT_THRESHOLD = 5;
export const LOCKOUT_SECONDS = 15 * 60;

const PREFIX = "element";

let redisClient: Redis | null | undefined;
/** Shared Upstash client, or null in local development without Upstash. */
export function redis(): Redis | null {
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
