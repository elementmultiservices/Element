import "server-only";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { FileListParams } from "@/lib/validation/files";
import { FILE_TYPES, type FileKind } from "./rules";

export const PAGE_SIZE = 20;

// Colombia has no DST: day boundaries are fixed at UTC-05:00.
const DAY_START = "T00:00:00-05:00";
const DAY_END = "T23:59:59.999-05:00";

/** Escapes LIKE wildcards so user input is matched literally. */
function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export type FileRow = {
  id: string;
  ownerId: string;
  uploadedBy: string;
  originalName: string;
  description: string | null;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  category: { nameEn: string; nameEs: string } | null;
};

/**
 * Lists files visible to the caller through RLS (own, non-trashed files for
 * users). `ownerId` narrows the list explicitly as a second safeguard.
 */
export async function listFiles(
  supabase: ServerSupabaseClient,
  params: FileListParams,
  options: { ownerId: string },
): Promise<{ rows: FileRow[]; total: number; pageCount: number }> {
  let query = supabase
    .from("files")
    .select(
      "id, owner_id, uploaded_by, original_name, description, mime_type, size_bytes, created_at, file_categories(name_en, name_es)",
      { count: "exact" },
    )
    .eq("owner_id", options.ownerId)
    .is("deleted_at", null);

  if (params.q) query = query.ilike("original_name", likePattern(params.q));
  if (params.type) query = query.eq("mime_type", FILE_TYPES[params.type as FileKind].mime);
  if (params.category) query = query.eq("category_id", params.category);
  if (params.from) query = query.gte("created_at", `${params.from}${DAY_START}`);
  if (params.to) query = query.lte("created_at", `${params.to}${DAY_END}`);

  const from = (params.page - 1) * PAGE_SIZE;
  const { data, count, error } = await query
    .order(params.sort, { ascending: params.dir === "asc" })
    .order("id", { ascending: true })
    .range(from, from + PAGE_SIZE - 1);

  if (error) {
    // Out-of-range pages return an error from PostgREST; treat as empty.
    if (error.code === "PGRST103") return { rows: [], total: count ?? 0, pageCount: Math.ceil((count ?? 0) / PAGE_SIZE) };
    throw new Error(`files query failed: ${error.code}`);
  }

  const total = count ?? 0;
  return {
    total,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    rows: (data ?? []).map((r) => ({
      id: r.id,
      ownerId: r.owner_id,
      uploadedBy: r.uploaded_by,
      originalName: r.original_name,
      description: r.description,
      mimeType: r.mime_type,
      sizeBytes: r.size_bytes,
      createdAt: r.created_at,
      category: r.file_categories ? { nameEn: r.file_categories.name_en, nameEs: r.file_categories.name_es } : null,
    })),
  };
}

export type StorageUsage = { usedBytes: number; quotaBytes: number };

export async function getStorageUsage(supabase: ServerSupabaseClient, ownerId: string): Promise<StorageUsage> {
  const { data, error } = await supabase.rpc("storage_usage", { p_owner: ownerId }).single();
  if (error || !data) throw new Error(`storage_usage failed: ${error?.code ?? "none"}`);
  return { usedBytes: data.used_bytes, quotaBytes: data.quota_bytes };
}

export type CategoryOption = { id: string; nameEn: string; nameEs: string };

export async function listActiveCategories(supabase: ServerSupabaseClient): Promise<CategoryOption[]> {
  const { data } = await supabase.from("file_categories").select("id, name_en, name_es").eq("is_archived", false).order("name_en");
  return (data ?? []).map((c) => ({ id: c.id, nameEn: c.name_en, nameEs: c.name_es }));
}
