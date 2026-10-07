import "server-only";
import { z } from "zod";

/**
 * Server-side environment. Read lazily (at request time) so `next build` does
 * not require production secrets. Secrets never use the NEXT_PUBLIC_ prefix.
 */

const emptyToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const optionalString = z.preprocess(emptyToUndefined, z.string().optional());
const optionalUrl = z.preprocess(emptyToUndefined, z.url().optional());

const serverSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
  NEXT_PUBLIC_SITE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  SESSION_SECRET: z.string().min(32),
  RECAPTCHA_SECRET_KEY: optionalString,
  RECAPTCHA_MIN_SCORE: z.preprocess(emptyToUndefined, z.coerce.number().min(0).max(1).default(0.5)),
  UPSTASH_REDIS_REST_URL: optionalUrl,
  UPSTASH_REDIS_REST_TOKEN: optionalString,
  RESEND_API_KEY: optionalString,
  EMAIL_FROM: z.preprocess(emptyToUndefined, z.string().default("Element <no-reply@example.com>")),
  CONTACT_INBOX: z.preprocess(emptyToUndefined, z.email().default("contact@example.com")),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | null = null;

export const isProduction = process.env.NODE_ENV === "production";

export function serverEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    // Log only the variable names, never their values.
    const keys = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid server environment: ${keys}`);
  }
  const env = parsed.data;

  // Development fallbacks (no reCAPTCHA, in-memory rate limiting, emails logged
  // to the console) are never allowed in a production build.
  if (isProduction) {
    const missing: string[] = [];
    if (!env.RECAPTCHA_SECRET_KEY) missing.push("RECAPTCHA_SECRET_KEY");
    if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) missing.push("UPSTASH_REDIS_REST_URL/TOKEN");
    if (!env.RESEND_API_KEY) missing.push("RESEND_API_KEY");
    if (missing.length > 0) throw new Error(`Missing production configuration: ${missing.join(", ")}`);
  }

  cached = env;
  return env;
}
