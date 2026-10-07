import { z } from "zod";
import { FILE_KINDS, MAX_DESCRIPTION_LENGTH, MAX_NAME_LENGTH } from "@/lib/files/rules";

export const uploadIntentSchema = z.object({
  name: z.string().min(1).max(MAX_NAME_LENGTH),
  size: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  mime: z.string().max(200),
  categoryId: z.uuid().nullish(),
  description: z
    .string()
    .trim()
    .max(MAX_DESCRIPTION_LENGTH)
    .nullish()
    .transform((v) => (v ? v : null)),
  /** Only honored for administrators (upload on behalf of a user). */
  ownerId: z.uuid().nullish(),
  recaptchaToken: z.string().max(4000).nullish(),
});

export const uploadConfirmSchema = z.object({ intentId: z.uuid() });

const sortColumns = ["created_at", "original_name", "size_bytes"] as const;
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Query-string filters for file listings. Invalid values silently fall back to defaults. */
export const fileListParamsSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  type: z.enum(FILE_KINDS as [string, ...string[]]).optional().catch(undefined),
  category: z.uuid().optional().catch(undefined),
  from: isoDate.optional().catch(undefined),
  to: isoDate.optional().catch(undefined),
  sort: z.enum(sortColumns).default("created_at").catch("created_at"),
  dir: z.enum(["asc", "desc"]).default("desc").catch("desc"),
  page: z.coerce.number().int().min(1).max(10_000).default(1).catch(1),
});

export type FileListParams = z.infer<typeof fileListParamsSchema>;
export type FileSort = (typeof sortColumns)[number];

export const profileNameSchema = z.object({
  fullName: z.string({ error: "required" }).trim().min(2, { error: "required" }).max(120, { error: "tooLong" }),
});
