import type { NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { listAdminFiles, listUsers, searchAudit, userLabels } from "@/lib/admin/queries";
import { apiError, authFailure } from "@/lib/api";
import { audit } from "@/lib/audit";
import { authorize } from "@/lib/auth/session";
import { toCsv, type CsvValue } from "@/lib/csv";
import { FILE_TYPES, kindFromMime, sanitizeDisplayName } from "@/lib/files/rules";
import { toLocale } from "@/i18n/routing";
import { rateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { adminFileListParamsSchema, auditListParamsSchema, userListParamsSchema } from "@/lib/validation/admin";

const MAX_ROWS = 50_000;
const KINDS = ["users", "files", "audit"] as const;
type Kind = (typeof KINDS)[number];

/**
 * CSV exports for administrators. The same filters as the on-screen lists are
 * accepted as query parameters; data is read with the admin's own session.
 */
export async function GET(request: NextRequest, { params }: RouteContext<"/api/admin/export/[kind]">) {
  const auth = await authorize({ role: "admin" });
  if (!auth.ok) return authFailure(auth.reason);
  const { ctx } = auth;

  const { kind: rawKind } = await params;
  if (!(KINDS as readonly string[]).includes(rawKind)) return apiError("not_found", 404);
  const kind = rawKind as Kind;

  if (!(await rateLimit("adminExportUser", ctx.userId)).success) return apiError("rate_limited", 429);

  const search = Object.fromEntries(request.nextUrl.searchParams);
  const locale = toLocale(search.locale ?? ctx.locale);
  const delimiter = locale === "es" ? ";" : ",";
  const t = await getTranslations({ locale, namespace: "Admin" });
  const supabase = await createClient();

  let headers: string[];
  let rows: CsvValue[][];
  let filters: Record<string, unknown>;

  if (kind === "users") {
    const p = { ...userListParamsSchema.parse(search), page: 1 };
    filters = { q: p.q, status: p.status, role: p.role, upload: p.upload };
    const { rows: users } = await listUsers(supabase, p, { limit: MAX_ROWS });
    headers = [
      t("csv.users.id"), t("csv.users.name"), t("csv.users.email"), t("csv.users.role"), t("csv.users.status"),
      t("csv.users.upload"), t("csv.users.language"), t("csv.users.files"), t("csv.users.usedBytes"), t("csv.users.quotaBytes"),
      t("csv.users.mfa"), t("csv.users.lastSignIn"), t("csv.users.created"),
    ];
    rows = users.map((u) => [
      u.id,
      u.fullName,
      u.email,
      u.role,
      u.invitationPending ? t("statuses.pending") : u.isActive ? t("statuses.active") : t("statuses.inactive"),
      u.role === "user" ? (u.canUpload ? t("common.yes") : t("common.no")) : null,
      u.locale,
      u.fileCount,
      u.usedBytes,
      u.quotaBytes,
      u.hasMfa ? t("common.yes") : t("common.no"),
      u.lastSignInAt,
      u.createdAt,
    ]);
  } else if (kind === "files") {
    const p = { ...adminFileListParamsSchema.parse(search), page: 1 };
    filters = { q: p.q, owner: p.owner, type: p.type, category: p.category, from: p.from, to: p.to };
    const { rows: files } = await listAdminFiles(supabase, p, { limit: MAX_ROWS });
    const labels = await userLabels(supabase, files.flatMap((f) => [f.ownerId, f.uploadedBy]));
    headers = [
      t("csv.files.id"), t("csv.files.name"), t("csv.files.ownerName"), t("csv.files.ownerEmail"), t("csv.files.category"),
      t("csv.files.type"), t("csv.files.sizeBytes"), t("csv.files.checksum"), t("csv.files.uploadedBy"), t("csv.files.created"),
    ];
    rows = files.map((f) => {
      const owner = labels.get(f.ownerId);
      const uploader = labels.get(f.uploadedBy);
      const kindLabel = kindFromMime(f.mimeType);
      return [
        f.id,
        sanitizeDisplayName(f.originalName),
        owner?.fullName ?? "",
        owner?.email ?? "",
        f.category ? (locale === "es" ? f.category.nameEs : f.category.nameEn) : "",
        kindLabel ? FILE_TYPES[kindLabel].label : f.mimeType,
        f.sizeBytes,
        f.checksum,
        uploader?.email ?? "",
        f.createdAt,
      ];
    });
  } else {
    const p = { ...auditListParamsSchema.parse(search), page: 1 };
    filters = { q: p.q, action: p.action, actor: p.actor, subject: p.subject, from: p.from, to: p.to };
    const { rows: entries } = await searchAudit(supabase, p, { limit: MAX_ROWS });
    headers = [
      t("csv.audit.id"), t("csv.audit.date"), t("csv.audit.action"), t("csv.audit.actorEmail"), t("csv.audit.targetType"),
      t("csv.audit.targetId"), t("csv.audit.targetLabel"), t("csv.audit.ip"), t("csv.audit.userAgent"), t("csv.audit.details"),
    ];
    rows = entries.map((a) => [
      a.id,
      a.createdAt,
      a.action,
      a.actorEmail ?? "",
      a.targetType ?? "",
      a.targetId ?? "",
      a.targetLabel ?? "",
      a.ip ?? "",
      a.userAgent ?? "",
      JSON.stringify(a.metadata),
    ]);
  }

  await audit({
    actorId: ctx.userId,
    action: "admin.export",
    targetType: "export",
    targetId: kind,
    metadata: { rows: rows.length, filters: JSON.parse(JSON.stringify(filters)) },
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(toCsv(headers, rows, delimiter), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="element-${kind}-${stamp}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
