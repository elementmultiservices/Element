import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk, authFailure } from "@/lib/api";
import { audit } from "@/lib/audit";
import { authorize } from "@/lib/auth/session";
import { inspectFile, sha256Hex } from "@/lib/files/inspect";
import { kindFromMime, MAX_FILE_BYTES, sanitizeDownloadName } from "@/lib/files/rules";
import { INTAKE_BUCKET, redirectToIntakeObject } from "@/lib/intake/storage";
import { rateLimit } from "@/lib/security/rate-limit";
import { isSameOrigin } from "@/lib/security/origin";
import { requestMeta } from "@/lib/security/request-meta";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type Context = RouteContext<"/api/intake/uploads/[id]">;

/** The caller's own upload that has not been attached to a submitted form yet. */
async function pendingUpload(request: NextRequest, { params }: Context) {
  if (!isSameOrigin(request)) return { response: apiError("forbidden", 403) } as const;
  const auth = await authorize();
  if (!auth.ok) return { response: authFailure(auth.reason) } as const;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return { response: apiError("not_found", 404) } as const;

  const admin = createAdminClient();
  const { data: upload } = await admin
    .from("intake_uploads")
    .select("*")
    .eq("id", id)
    .eq("owner_id", auth.ctx.userId)
    .is("submission_id", null)
    .maybeSingle();
  if (!upload) return { response: apiError("not_found", 404) } as const;
  return { upload, admin, ctx: auth.ctx } as const;
}

/**
 * Step 2 of an intake document upload: verifies the stored object (real size,
 * magic bytes, no active content) and records its SHA-256. Rejected objects
 * are deleted together with their row.
 */
export async function POST(request: NextRequest, context: Context) {
  const found = await pendingUpload(request, context);
  if ("response" in found) return found.response;
  const { upload, admin, ctx } = found;
  if (upload.checksum_sha256) return apiOk({ id: upload.id });
  if (new Date(upload.expires_at).getTime() < Date.now()) return apiError("intent_invalid", 409);

  const storage = admin.storage.from(INTAKE_BUCKET);
  const meta = await requestMeta();
  const reject = async (code: "upload_missing" | "empty_file" | "size_mismatch" | "content_rejected" | "type_not_allowed", reason: string) => {
    await storage.remove([upload.storage_path]);
    await admin.from("intake_uploads").delete().eq("id", upload.id);
    await audit(
      {
        actorId: ctx.userId,
        action: "intake.upload_rejected",
        targetType: "user",
        targetId: ctx.userId,
        metadata: { reason, declared_mime: upload.mime_type, declared_size: upload.size_bytes },
      },
      meta,
    );
    return apiError(code, code === "upload_missing" ? 409 : 422);
  };

  const { data: blob, error } = await storage.download(upload.storage_path);
  if (error || !blob) return reject("upload_missing", "object_missing");

  const buf = new Uint8Array(await blob.arrayBuffer());
  if (buf.byteLength === 0) return reject("empty_file", "empty");
  if (buf.byteLength !== upload.size_bytes || buf.byteLength > MAX_FILE_BYTES) return reject("size_mismatch", "size_mismatch");
  if (blob.type && blob.type.split(";")[0] !== upload.mime_type) return reject("content_rejected", "content_type_mismatch");

  const kind = kindFromMime(upload.mime_type);
  if (!kind) return reject("type_not_allowed", "mime_not_allowed");
  const inspection = inspectFile(buf, kind);
  if (!inspection.ok) return reject("content_rejected", inspection.reason);

  const { error: updateError } = await admin.from("intake_uploads").update({ checksum_sha256: sha256Hex(buf) }).eq("id", upload.id);
  if (updateError) {
    console.error(`[intake] checksum update failed: ${updateError.code}`);
    return apiError("server_error", 500);
  }
  return apiOk({ id: upload.id });
}

/** Removes a document the client attached but no longer wants (before submitting). */
export async function DELETE(request: NextRequest, context: Context) {
  const found = await pendingUpload(request, context);
  if ("response" in found) return found.response;
  const { upload, admin } = found;
  await admin.storage.from(INTAKE_BUCKET).remove([upload.storage_path]);
  await admin.from("intake_uploads").delete().eq("id", upload.id);
  return apiOk({ id: upload.id });
}

/** Downloads a document of a submitted form (its owner or an administrator; RLS decides). */
export async function GET(_request: NextRequest, { params }: Context) {
  const auth = await authorize();
  if (!auth.ok) return authFailure(auth.reason);
  const { ctx } = auth;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return apiError("not_found", 404);

  const meta = await requestMeta();
  if (!(await rateLimit("downloadIp", meta.ip)).success) return apiError("rate_limited", 429);
  if (!(await rateLimit("downloadUser", ctx.userId)).success) return apiError("rate_limited", 429);

  const supabase = await createClient();
  const { data: upload } = await supabase
    .from("intake_uploads")
    .select("id, owner_id, submission_id, original_name, storage_path")
    .eq("id", id)
    .not("submission_id", "is", null)
    .maybeSingle();
  if (!upload) return apiError("not_found", 404);

  await audit(
    {
      actorId: ctx.userId,
      action: "intake.document_downloaded",
      targetType: "intake",
      targetId: upload.submission_id ?? undefined,
      metadata: { upload_id: upload.id, owner_id: upload.owner_id },
    },
    meta,
  );
  return redirectToIntakeObject(upload.storage_path, sanitizeDownloadName(upload.original_name));
}
