import "server-only";
import { FILE_TYPES, type FileKind } from "@/lib/files/rules";
import type { Json } from "@/lib/supabase/database.types";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { AdminFileListParams, AuditListParams, TrashListParams, UserListParams } from "@/lib/validation/admin";

/**
 * Admin read models. All queries run with the admin's own session: RLS and the
 * is_admin() checks inside the SQL functions (active admin + MFA) apply.
 */

export const ADMIN_PAGE_SIZE = 25;
export const TRASH_RETENTION_DAYS = 30;

// Colombia has no DST: day boundaries are fixed at UTC-05:00.
const DAY_START = "T00:00:00-05:00";
const DAY_END = "T23:59:59.999-05:00";

function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

function fail(scope: string, code: string | undefined): never {
  throw new Error(`[admin] ${scope} failed: ${code ?? "unknown"}`);
}

export type Paged<T> = { rows: T[]; total: number; page: number; pageCount: number };

function paged<T>(rows: T[], total: number, page: number, pageSize = ADMIN_PAGE_SIZE): Paged<T> {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  return { rows, total, page: Math.min(page, pageCount), pageCount };
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
export type AdminUserRow = {
  id: string;
  email: string;
  fullName: string;
  role: "user" | "admin";
  isActive: boolean;
  locale: "en" | "es";
  quotaBytes: number;
  usedBytes: number;
  fileCount: number;
  createdAt: string;
  lastSignInAt: string | null;
  invitationPending: boolean;
  hasMfa: boolean;
  canUpload: boolean;
  /** Last four digits of the tax ID (SSN, ITIN or EIN), or null. */
  idLast4: string | null;
};

type UserRpcRow = {
  id: string;
  email: string;
  full_name: string;
  role: "user" | "admin";
  is_active: boolean;
  preferred_locale: "en" | "es";
  storage_quota_bytes: number;
  used_bytes: number;
  file_count: number;
  created_at: string;
  last_sign_in_at: string | null;
  invitation_pending: boolean;
  has_mfa: boolean;
  can_upload: boolean;
  /** Missing until migration 20261023000300 is applied. */
  id_last4?: string | null;
  total_count: number;
};

function toUser(r: UserRpcRow): AdminUserRow {
  return {
    id: r.id,
    email: r.email,
    fullName: r.full_name,
    role: r.role,
    isActive: r.is_active,
    locale: r.preferred_locale,
    quotaBytes: r.storage_quota_bytes,
    usedBytes: r.used_bytes,
    fileCount: r.file_count,
    createdAt: r.created_at,
    lastSignInAt: r.last_sign_in_at,
    invitationPending: r.invitation_pending,
    hasMfa: r.has_mfa,
    canUpload: r.can_upload,
    idLast4: r.id_last4 ?? null,
  };
}

export async function listUsers(
  supabase: ServerSupabaseClient,
  params: UserListParams,
  options: { limit?: number } = {},
): Promise<Paged<AdminUserRow>> {
  const limit = options.limit ?? ADMIN_PAGE_SIZE;
  const { data, error } = await supabase.rpc("admin_list_users", {
    p_search: params.q ?? undefined,
    p_status: params.status ?? undefined,
    p_role: params.role ?? undefined,
    p_upload: params.upload ?? undefined,
    p_sort: params.sort,
    p_dir: params.dir,
    p_limit: limit,
    p_offset: (params.page - 1) * limit,
  });
  if (error) fail("admin_list_users", error.code);
  const rows = (data ?? []) as UserRpcRow[];
  return paged(rows.map(toUser), rows[0]?.total_count ?? 0, params.page, limit);
}

export async function getUser(supabase: ServerSupabaseClient, id: string): Promise<AdminUserRow | null> {
  const { data, error } = await supabase.rpc("admin_list_users", { p_id: id, p_limit: 1 });
  if (error) fail("admin_list_users(id)", error.code);
  const row = (data ?? [])[0] as UserRpcRow | undefined;
  return row ? toUser(row) : null;
}

export type UploadGrantRow = { email: string; grantedBy: string | null; createdAt: string };

/** Addresses pre-authorized to upload that have no verified account yet. */
export async function listUploadGrants(supabase: ServerSupabaseClient): Promise<UploadGrantRow[]> {
  const { data, error } = await supabase
    .from("upload_grants")
    .select("email, granted_by, created_at")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) fail("upload_grants", error.code);
  return (data ?? []).map((r) => ({ email: r.email, grantedBy: r.granted_by, createdAt: r.created_at }));
}

export type UserLabel = { id: string; fullName: string; email: string };

export async function userLabels(supabase: ServerSupabaseClient, ids: (string | null | undefined)[]): Promise<Map<string, UserLabel>> {
  const unique = [...new Set(ids.filter((v): v is string => typeof v === "string"))];
  if (unique.length === 0) return new Map();
  const { data, error } = await supabase.rpc("admin_user_labels", { p_ids: unique });
  if (error) fail("admin_user_labels", error.code);
  return new Map((data ?? []).map((r) => [r.id, { id: r.id, fullName: r.full_name, email: r.email }]));
}

export type UserOption = UserLabel & { role: "user" | "admin"; isActive: boolean };

export async function userOptions(supabase: ServerSupabaseClient): Promise<UserOption[]> {
  const { data, error } = await supabase.rpc("admin_user_options");
  if (error) fail("admin_user_options", error.code);
  return (data ?? []).map((r) => ({ id: r.id, fullName: r.full_name, email: r.email, role: r.role, isActive: r.is_active }));
}

export function userDisplayName(label: { fullName: string; email: string } | undefined, fallback: string): string {
  if (!label) return fallback;
  return label.fullName.trim() || label.email;
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------
export type Overview = {
  usersTotal: number;
  usersActive: number;
  usersInactive: number;
  usersPending: number;
  filesActive: number;
  filesTrashed: number;
  storageUsedBytes: number;
  storageTrashedBytes: number;
  uploadsLast7d: number;
};

export async function getOverview(supabase: ServerSupabaseClient): Promise<Overview> {
  const { data, error } = await supabase.rpc("admin_overview").single();
  if (error || !data) fail("admin_overview", error?.code);
  return {
    usersTotal: data.users_total,
    usersActive: data.users_active,
    usersInactive: data.users_inactive,
    usersPending: data.users_pending,
    filesActive: data.files_active,
    filesTrashed: data.files_trashed,
    storageUsedBytes: data.storage_used_bytes,
    storageTrashedBytes: data.storage_trashed_bytes,
    uploadsLast7d: data.uploads_last_7d,
  };
}

// ---------------------------------------------------------------------------
// Files (active and trash)
// ---------------------------------------------------------------------------
export type AdminFileRow = {
  id: string;
  ownerId: string;
  uploadedBy: string;
  originalName: string;
  description: string | null;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
  createdAt: string;
  deletedAt: string | null;
  deletedBy: string | null;
  category: { nameEn: string; nameEs: string } | null;
};

const FILE_COLUMNS =
  "id, owner_id, uploaded_by, original_name, description, mime_type, size_bytes, checksum_sha256, created_at, deleted_at, deleted_by, file_categories(name_en, name_es)" as const;

type FileQueryRow = {
  id: string;
  owner_id: string;
  uploaded_by: string;
  original_name: string;
  description: string | null;
  mime_type: string;
  size_bytes: number;
  checksum_sha256: string;
  created_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
  file_categories: { name_en: string; name_es: string } | null;
};

function toFile(r: FileQueryRow): AdminFileRow {
  return {
    id: r.id,
    ownerId: r.owner_id,
    uploadedBy: r.uploaded_by,
    originalName: r.original_name,
    description: r.description,
    mimeType: r.mime_type,
    sizeBytes: r.size_bytes,
    checksum: r.checksum_sha256,
    createdAt: r.created_at,
    deletedAt: r.deleted_at,
    deletedBy: r.deleted_by,
    category: r.file_categories ? { nameEn: r.file_categories.name_en, nameEs: r.file_categories.name_es } : null,
  };
}

export async function listAdminFiles(
  supabase: ServerSupabaseClient,
  params: AdminFileListParams,
  options: { limit?: number } = {},
): Promise<Paged<AdminFileRow>> {
  const limit = options.limit ?? ADMIN_PAGE_SIZE;
  let query = supabase.from("files").select(FILE_COLUMNS, { count: "exact" }).is("deleted_at", null);
  if (params.q) query = query.ilike("original_name", likePattern(params.q));
  if (params.owner) query = query.eq("owner_id", params.owner);
  if (params.type) query = query.eq("mime_type", FILE_TYPES[params.type as FileKind].mime);
  if (params.category) query = query.eq("category_id", params.category);
  if (params.from) query = query.gte("created_at", `${params.from}${DAY_START}`);
  if (params.to) query = query.lte("created_at", `${params.to}${DAY_END}`);

  const from = (params.page - 1) * limit;
  const { data, count, error } = await query
    .order(params.sort, { ascending: params.dir === "asc" })
    .order("id", { ascending: true })
    .range(from, from + limit - 1);
  if (error && error.code !== "PGRST103") fail("files", error.code);
  return paged(((data ?? []) as FileQueryRow[]).map(toFile), count ?? 0, params.page, limit);
}

export async function listTrash(supabase: ServerSupabaseClient, params: TrashListParams): Promise<Paged<AdminFileRow>> {
  let query = supabase.from("files").select(FILE_COLUMNS, { count: "exact" }).not("deleted_at", "is", null);
  if (params.q) query = query.ilike("original_name", likePattern(params.q));
  if (params.owner) query = query.eq("owner_id", params.owner);
  const from = (params.page - 1) * ADMIN_PAGE_SIZE;
  const { data, count, error } = await query
    .order("deleted_at", { ascending: false })
    .order("id", { ascending: true })
    .range(from, from + ADMIN_PAGE_SIZE - 1);
  if (error && error.code !== "PGRST103") fail("trash", error.code);
  return paged(((data ?? []) as FileQueryRow[]).map(toFile), count ?? 0, params.page);
}

export function purgeDate(deletedAt: string): Date {
  return new Date(new Date(deletedAt).getTime() + TRASH_RETENTION_DAYS * 86_400_000);
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------
export type AuditRow = {
  id: number;
  createdAt: string;
  action: string;
  actorId: string | null;
  actorEmail: string | null;
  actorName: string | null;
  targetType: string | null;
  targetId: string | null;
  targetLabel: string | null;
  metadata: Json;
  ip: string | null;
  userAgent: string | null;
};

export async function searchAudit(
  supabase: ServerSupabaseClient,
  params: AuditListParams,
  options: { limit?: number; exactAction?: string } = {},
): Promise<Paged<AuditRow>> {
  const limit = options.limit ?? ADMIN_PAGE_SIZE;
  const { data, error } = await supabase.rpc("admin_search_audit", {
    p_q: params.q ?? undefined,
    p_action: options.exactAction ?? (params.action ? `${params.action}.` : undefined),
    p_actor: params.actor ?? undefined,
    p_subject: params.subject ?? undefined,
    p_from: params.from ?? undefined,
    p_to: params.to ?? undefined,
    p_limit: limit,
    p_offset: (params.page - 1) * limit,
  });
  if (error) fail("admin_search_audit", error.code);
  const rows = data ?? [];
  return paged(
    rows.map((r) => ({
      id: r.id,
      createdAt: r.created_at,
      action: r.action,
      actorId: r.actor_id,
      actorEmail: r.actor_email,
      actorName: r.actor_name,
      targetType: r.target_type,
      targetId: r.target_id,
      targetLabel: r.target_label,
      metadata: r.metadata,
      ip: r.ip === null ? null : String(r.ip),
      userAgent: r.user_agent,
    })),
    rows[0]?.total_count ?? 0,
    params.page,
    limit,
  );
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------
export type AdminCategoryRow = { id: string; nameEn: string; nameEs: string; isArchived: boolean; fileCount: number };

export async function listCategories(supabase: ServerSupabaseClient): Promise<AdminCategoryRow[]> {
  const { data, error } = await supabase.rpc("admin_list_categories");
  if (error) fail("admin_list_categories", error.code);
  return (data ?? []).map((c) => ({ id: c.id, nameEn: c.name_en, nameEs: c.name_es, isArchived: c.is_archived, fileCount: c.file_count }));
}
