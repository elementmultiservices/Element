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
  upload: z.enum(["yes", "no"]).optional().catch(undefined),
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

export const uploadGrantSchema = z.object({ email: emailSchema });

export const roleChangeSchema = z.object({
  id: z.uuid(),
  role: z.enum(["user", "admin"]),
  code: z.string({ error: "required" }).trim().regex(/^\d{6}$/, { error: "codeInvalid" }),
});

const categoryName = z.string({ error: "required" }).trim().min(1, { error: "required" }).max(80, { error: "tooLong" });
export const categoryCreateSchema = z.object({ nameEn: categoryName, nameEs: categoryName });
export const categoryRenameSchema = z.object({ id: z.uuid(), nameEn: categoryName, nameEs: categoryName });

// ---------------------------------------------------------------------------
// Business details (site_settings)
// ---------------------------------------------------------------------------
const httpsUrl = z
  .string()
  .trim()
  .max(1000, { error: "tooLong" })
  .refine((v) => v === "" || /^https:\/\/[^\s]+$/.test(v), { error: "urlInvalid" });

/** Multi-line text: trims each line and drops empty ones. */
const multiline = z
  .string()
  .max(1000, { error: "tooLong" })
  .transform((v) =>
    v
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .join("\n"),
  );

export const siteSettingsSchema = z.object({
  phone: z
    .string()
    .trim()
    .max(40, { error: "tooLong" })
    .refine((v) => v === "" || v.replace(/\D/g, "").length >= 7, { error: "phoneInvalid" }),
  whatsapp: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v === "" || (v.length >= 7 && v.length <= 15), { error: "phoneInvalid" }),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, { error: "tooLong" })
    .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), { error: "emailInvalid" }),
  address: z.string().trim().max(300, { error: "tooLong" }),
  mapsUrl: httpsUrl,
  bookingUrl: httpsUrl,
  hoursRegularEs: multiline,
  hoursRegularEn: multiline,
  hoursSeasonEs: multiline,
  hoursSeasonEn: multiline,
  announcementEnabled: z.literal("on").optional().transform((v) => v === "on"),
  announcementLabelEs: z.string().trim().max(40, { error: "tooLong" }),
  announcementLabelEn: z.string().trim().max(40, { error: "tooLong" }),
  announcementTextEs: z.string().trim().max(200, { error: "tooLong" }),
  announcementTextEn: z.string().trim().max(200, { error: "tooLong" }),
});
export type SiteSettingsField = keyof z.input<typeof siteSettingsSchema>;
