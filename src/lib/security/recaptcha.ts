import "server-only";
import { z } from "zod";
import { isProduction, serverEnv } from "@/lib/env";

export type RecaptchaAction = "sign_in" | "sign_up" | "password_reset" | "upload" | "contact" | "newsletter" | "intake_upload" | "intake_submit";

const responseSchema = z.object({
  success: z.boolean(),
  score: z.number().optional(),
  action: z.string().optional(),
  hostname: z.string().optional(),
  "error-codes": z.array(z.string()).optional(),
});

/**
 * Verifies a reCAPTCHA v3 token on the server: success flag, expected action
 * and minimum score. Without a secret key the check is skipped in development
 * only; serverEnv() refuses to start a production build without it.
 */
export async function verifyRecaptcha(
  token: FormDataEntryValue | string | null | undefined,
  action: RecaptchaAction,
  ip: string | null,
): Promise<boolean> {
  return (await assessRecaptcha(token, action, ip)).ok;
}

export type RecaptchaAssessment = { ok: boolean; score: number | null };

/**
 * Same verification, also returning the score so callers can demand a higher
 * one for riskier side effects (e.g. sending an email to a typed address).
 * Without a secret key (development only) the score is null.
 */
export async function assessRecaptcha(
  token: FormDataEntryValue | string | null | undefined,
  action: RecaptchaAction,
  ip: string | null,
): Promise<RecaptchaAssessment> {
  const env = serverEnv();
  if (!env.RECAPTCHA_SECRET_KEY) return { ok: !isProduction, score: null };
  if (typeof token !== "string" || token.length < 20 || token.length > 4000) return { ok: false, score: null };

  const body = new URLSearchParams({ secret: env.RECAPTCHA_SECRET_KEY, response: token });
  if (ip) body.set("remoteip", ip);

  try {
    const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { ok: false, score: null };
    const parsed = responseSchema.safeParse(await res.json());
    if (!parsed.success) return { ok: false, score: null };
    const { success, score, action: returnedAction, hostname } = parsed.data;
    const value = score ?? 0;
    const ok = success && returnedAction === action && value >= env.RECAPTCHA_MIN_SCORE;
    if (!ok) {
      // Why it failed, for diagnosis (e.g. "browser-error" when the host is not
      // listed for the site key, or a low score). Never the token itself.
      console.warn(
        `[recaptcha] rejected: action=${action} returned=${returnedAction ?? "none"} score=${value} host=${hostname ?? "none"} errors=${(parsed.data["error-codes"] ?? []).join(",") || "none"}`,
      );
    }
    return { ok, score: value };
  } catch {
    console.error("[recaptcha] verification request failed");
    return { ok: false, score: null };
  }
}
