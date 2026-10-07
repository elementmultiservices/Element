import { z } from "zod";
import { FILE_KINDS } from "@/lib/files/rules";
import { emailSchema } from "./auth";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const page = z.coerce.number().int().min(1).max(10_000).default(1).catch(1);
const dir = z.enum(["asc", "desc"]).default("desc").catch("desc");
const text = (max: number) => z.string().trim().max(max).optional().catch(undefined);

/** Query-string filters. Invalid values fall back to defaults instead of erroring. */
export const userListParamsSchema = z.object({
  q: text(100),
  status: z.enum(["active", "inactive", "pending"]).optional().catch(undefined),
  role: z.enum(["user", "admin"]).optional().catch(undefined),
  sort: z.enum(["created_at", "full_name", "email", "last_sign_in_at", "used_bytes"]).default("created_at").catch("created_at"),
  dir,
  page,
});
export type UserListParams = z.infer<typeof userListParamsSchema>;

export const adminFileListParamsSchema = z.object({
  q: text(100),
  owner: z.uuid().optional().catch(undefined),
  type: z.enum(FILE_KINDS as [string, ...string[]]).optional().catch(undefined),
  category: z.uuid().optional().catch(undefined),
  from: isoDate.optional().catch(undefined),
  to: isoDate.optional().catch(undefined),
  sort: z.enum(["created_at", "original_name", "size_bytes"]).default("created_at").catch("created_at"),
  dir,
  page,
});
export type AdminFileListParams = z.infer<typeof adminFileListParamsSchema>;

export const trashListParamsSchema = z.object({
  q: text(100),
  owner: z.uuid().optional().catch(undefined),
  page,
});
export type TrashListParams = z.infer<typeof trashListParamsSchema>;

export const AUDIT_GROUPS = ["auth", "user", "file", "category", "post", "contact", "admin"] as const;
export type AuditGroup = (typeof AUDIT_GROUPS)[number];

export const auditListParamsSchema = z.object({
  q: text(200),
  action: z.enum(AUDIT_GROUPS).optional().catch(undefined),
  actor: text(100),
  subject: z.uuid().optional().catch(undefined),
  from: isoDate.optional().catch(undefined),
  to: isoDate.optional().catch(undefined),
  page,
});
export type AuditListParams = z.infer<typeof auditListParamsSchema>;

// ---------------------------------------------------------------------------
// Mutations (error messages are keys of the "Validation" namespace)
// ---------------------------------------------------------------------------
export const MAX_QUOTA_MB = 102_400;

const quotaMb = z.coerce
  .number({ error: "invalid" })
  .int({ error: "invalid" })
  .min(0, { error: "invalid" })
  .max(MAX_QUOTA_MB, { error: "invalid" });

export const inviteUserSchema = z.object({
  fullName: z.string({ error: "required" }).trim().min(2, { error: "required" }).max(120, { error: "tooLong" }),
  email: emailSchema,
  locale: z.enum(["en", "es"], { error: "invalid" }),
  quotaMb,
});

export const quotaSchema = z.object({ userId: z.uuid(), quotaMb });

export const idSchema = z.object({ id: z.uuid() });

const categoryName = z.string({ error: "required" }).trim().min(1, { error: "required" }).max(80, { error: "tooLong" });
export const categoryCreateSchema = z.object({ nameEn: categoryName, nameEs: categoryName });
export const categoryRenameSchema = z.object({ id: z.uuid(), nameEn: categoryName, nameEs: categoryName });
