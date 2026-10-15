import { z } from "zod";
import { emailSchema } from "./auth";

export const CONTACT_NEEDS = ["personal", "business", "itin", "company", "payroll", "documents", "other"] as const;

/** Optional fields of the short "question before your visit" form; folded into subject/message. */
export const contactExtrasSchema = z.object({
  phone: z
    .string()
    .trim()
    .max(40, { error: "tooLong" })
    .regex(/^[+()\d\s.-]{7,}$/, { error: "phoneInvalid" })
    .optional(),
  need: z.enum(CONTACT_NEEDS).optional(),
  preferredLanguage: z.enum(["es", "en"]).optional(),
});

export const contactSchema = z.object({
  name: z.string({ error: "required" }).trim().min(1, { error: "required" }).max(120, { error: "tooLong" }),
  email: emailSchema,
  subject: z.string({ error: "required" }).trim().min(1, { error: "required" }).max(200, { error: "tooLong" }),
  message: z.string({ error: "required" }).trim().min(10, { error: "messageMin" }).max(5000, { error: "tooLong" }),
  consent: z.literal("on", { error: "consentRequired" }),
});
