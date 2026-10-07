"use server";

import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/session";
import type { FormState } from "@/lib/forms";
import { rateLimit } from "@/lib/security/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { idSchema } from "@/lib/validation/admin";

type Result = FormState<never>;

async function prepare(formData: FormData): Promise<{ ok: true; adminId: string; id: string } | { ok: false; result: Result }> {
  const session = await requireAdmin();
  if (!(await rateLimit("adminActionUser", session.userId)).success) return { ok: false, result: { status: "error", error: "rateLimited" } };
  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { ok: false, result: { status: "error", error: "notFound" } };
  return { ok: true, adminId: session.userId, id: parsed.data.id };
}

/** Moves an active file to the trash (hidden from its owner; restorable for 30 days). */
export async function trashFileAction(_prev: Result, formData: FormData): Promise<Result> {
  const p = await prepare(formData);
  if (!p.ok) return p.result;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("files")
    .update({ deleted_at: new Date().toISOString(), deleted_by: p.adminId })
    .eq("id", p.id)
    .is("deleted_at", null)
    .select("id, owner_id, original_name")
    .maybeSingle();
  if (error) {
    console.error(`[admin] trash failed: ${error.code}`);
    return { status: "error", error: "generic" };
  }
  if (!data) return { status: "error", error: "notFound" };

  await audit({
    actorId: p.adminId,
    action: "file.trashed",
    targetType: "file",
    targetId: data.id,
    metadata: { owner_id: data.owner_id, original_name: data.original_name },
  });
  return { status: "success" };
}

export async function restoreFileAction(_prev: Result, formData: FormData): Promise<Result> {
  const p = await prepare(formData);
  if (!p.ok) return p.result;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("files")
    .update({ deleted_at: null, deleted_by: null })
    .eq("id", p.id)
    .not("deleted_at", "is", null)
    .select("id, owner_id, original_name")
    .maybeSingle();
  if (error) {
    console.error(`[admin] restore failed: ${error.code}`);
    return { status: "error", error: "generic" };
  }
  if (!data) return { status: "error", error: "notFound" };

  await audit({
    actorId: p.adminId,
    action: "file.restored",
    targetType: "file",
    targetId: data.id,
    metadata: { owner_id: data.owner_id, original_name: data.original_name },
  });
  return { status: "success" };
}

/**
 * Permanent deletion, only for files already in the trash. The row is read and
 * deleted with the admin's own session (RLS: is_admin() and deleted_at not
 * null); the storage object is removed with the service role in between.
 */
export async function deleteFilePermanentlyAction(_prev: Result, formData: FormData): Promise<Result> {
  const p = await prepare(formData);
  if (!p.ok) return p.result;

  const supabase = await createClient();
  const { data: file } = await supabase
    .from("files")
    .select("id, owner_id, original_name, storage_path, size_bytes")
    .eq("id", p.id)
    .not("deleted_at", "is", null)
    .maybeSingle();
  if (!file) return { status: "error", error: "notFound" };

  // Object first: if the row deletion then fails, the file simply stays in the
  // trash (pointing to nothing) and the action can be retried safely.
  const { error: storageError } = await createAdminClient().storage.from("files").remove([file.storage_path]);
  if (storageError) {
    console.error("[admin] storage removal failed");
    return { status: "error", error: "generic" };
  }

  const { error } = await supabase.from("files").delete().eq("id", file.id).not("deleted_at", "is", null);
  if (error) {
    console.error(`[admin] permanent delete failed: ${error.code}`);
    return { status: "error", error: "generic" };
  }

  await audit({
    actorId: p.adminId,
    action: "file.deleted_permanently",
    targetType: "file",
    targetId: file.id,
    metadata: { owner_id: file.owner_id, original_name: file.original_name, size_bytes: file.size_bytes },
  });
  return { status: "success" };
}
