import "server-only";
import { z } from "zod";
import { isProduction, serverEnv } from "@/lib/env";

export type RecaptchaAction = "sign_in" | "password_reset" | "upload" | "contact";

const responseSchema = z.object({
  success: z.boolean(),
  score: z.number().optional(),
  action: z.string().optional(),
  hostname: z.string().optional(),
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
  const env = serverEnv();
  if (!env.RECAPTCHA_SECRET_KEY) return !isProduction;
  if (typeof token !== "string" || token.length < 20 || token.length > 4000) return false;

  const body = new URLSearchParams({ secret: env.RECAPTCHA_SECRET_KEY, response: token });
  if (ip) body.set("remoteip", ip);

  try {
    const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return false;
    const parsed = responseSchema.safeParse(await res.json());
    if (!parsed.success) return false;
    const { success, score, action: returnedAction } = parsed.data;
    return success && returnedAction === action && (score ?? 0) >= env.RECAPTCHA_MIN_SCORE;
  } catch {
    console.error("[recaptcha] verification request failed");
    return false;
  }
}
