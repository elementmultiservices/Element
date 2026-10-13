import { z } from "zod";
import { MAX_SLUG_LENGTH, SLUG_PATTERN } from "@/lib/blog/slug";
import { emailSchema } from "./auth";

/** Error messages are keys of the "Validation" namespace. */

export const POST_STATUSES = ["draft", "scheduled", "published"] as const;

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .max(MAX_SLUG_LENGTH, { error: "tooLong" })
  .refine((v) => SLUG_PATTERN.test(v), { error: "slugInvalid" });

export const translationInputSchema = z.object({
  title: z.string().trim().min(1, { error: "titleRequired" }).max(200, { error: "tooLong" }),
  slug,
  excerpt: z.string().trim().max(500, { error: "tooLong" }),
  content: z.string().max(200_000, { error: "tooLong" }),
});
export type TranslationInput = z.infer<typeof translationInputSchema>;

/** "YYYY-MM-DDTHH:mm" from <input type="datetime-local">, interpreted in Bogotá time (UTC-5, no DST). */
export const localDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, { error: "invalid" })
  .transform((v) => new Date(`${v}:00-05:00`))
  .refine((d) => !Number.isNaN(d.getTime()), { error: "invalid" });

export const postMetaSchema = z.object({
  id: z.uuid().optional(),
  status: z.enum(POST_STATUSES, { error: "invalid" }),
  publishedAt: z.union([z.literal(""), localDateTime]).optional(),
  categoryId: z.union([z.literal(""), z.uuid({ error: "invalid" })]).optional(),
  kind: z.enum(["article", "update"], { error: "invalid" }).default("article"),
  featured: z.literal("on").optional().transform((v) => v === "on"),
  sourceUrl: z
    .string()
    .trim()
    .max(1000, { error: "tooLong" })
    .refine((v) => v === "" || /^https:\/\/[^\s]+$/.test(v), { error: "urlInvalid" })
    .default(""),
});

export const postCategorySchema = z.object({
  id: z.uuid().optional(),
  nameEn: z.string().trim().min(1, { error: "required" }).max(80, { error: "tooLong" }),
  nameEs: z.string().trim().min(1, { error: "required" }).max(80, { error: "tooLong" }),
  slugEn: slug,
  slugEs: slug,
});

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
