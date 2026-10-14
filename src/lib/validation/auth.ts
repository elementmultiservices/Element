import { z } from "zod";

/** Error messages are translation keys from the "Validation" namespace. */

export const emailSchema = z
  .string({ error: "required" })
  .trim()
  .min(1, { error: "required" })
  .max(254, { error: "tooLong" })
  .pipe(z.email({ error: "emailInvalid" }))
  .transform((v) => v.toLowerCase());

export const newPasswordSchema = z
  .string({ error: "required" })
  .min(12, { error: "passwordMin" })
  .max(128, { error: "passwordMax" })
  .refine((v) => /[a-z]/.test(v) && /[A-Z]/.test(v) && /\d/.test(v), { error: "passwordComplexity" });

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string({ error: "required" }).min(1, { error: "required" }).max(128, { error: "passwordMax" }),
});

export const passwordResetRequestSchema = z.object({ email: emailSchema });

/** Self-service sign-up. The password is chosen after the address is verified. */
export const signUpSchema = z.object({
  fullName: z.string({ error: "required" }).trim().min(2, { error: "required" }).max(120, { error: "tooLong" }),
  email: emailSchema,
  consent: z.literal("on", { error: "consentRequired" }),
});

export const updatePasswordSchema = z
  .object({
    password: newPasswordSchema,
    confirmPassword: z.string({ error: "required" }).min(1, { error: "required" }),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], error: "passwordMismatch" });

/** First password for accounts created with Google, confirmed with a code sent by email. */
export const setPasswordSchema = z
  .object({ code: z.string({ error: "required" }).trim().regex(/^\d{6}$/, { error: "codeInvalid" }) })
  .and(updatePasswordSchema);

export const confirmLinkSchema = z.object({
  tokenHash: z.string().min(10).max(500).regex(/^[A-Za-z0-9_-]+$/),
  type: z.enum(["recovery", "invite"]),
});

export const mfaVerifySchema = z.object({
  code: z.string({ error: "required" }).trim().regex(/^\d{6}$/, { error: "codeInvalid" }),
  factorId: z.uuid().optional(),
});

export const localeSchema = z.enum(["en", "es"]);
