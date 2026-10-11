import { after, type NextRequest } from "next/server";
import { apiError, apiOk, authFailure, type ApiErrorCode } from "@/lib/api";
import { audit } from "@/lib/audit";
import { authorize } from "@/lib/auth/session";
import { sendFileAssignedEmail } from "@/lib/email/file-emails";
import { inspectFile, sha256Hex } from "@/lib/files/inspect";
import { kindFromMime, MAX_FILE_BYTES } from "@/lib/files/rules";
import { rateLimit } from "@/lib/security/rate-limit";
import { isSameOrigin } from "@/lib/security/origin";
import { requestMeta } from "@/lib/security/request-meta";
import { createAdminClient } from "@/lib/supabase/admin";
import { uploadConfirmSchema } from "@/lib/validation/files";

const BUCKET = "files";

/**
 * Step 2 of the upload flow. Consumes the caller's intent exactly once, then
 * verifies the uploaded object (exists, real size, magic bytes, no active
 * content), computes its SHA-256, re-checks the quota, moves it to its final
 * random path and only then creates the files row. Rejected objects are deleted.
 */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return apiError("forbidden", 403);

  const auth = await authorize();
  if (!auth.ok) return authFailure(auth.reason);
  const { ctx } = auth;
  if (ctx.role !== "admin" && !ctx.canUpload) return apiError("upload_not_allowed", 403);
  const meta = await requestMeta();

  if (!(await rateLimit("uploadConfirmUser", ctx.userId)).success) return apiError("rate_limited", 429);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("bad_request", 400);
  }
  const parsed = uploadConfirmSchema.safeParse(body);
  if (!parsed.success) return apiError("bad_request", 400);

  const admin = createAdminClient();
  const storage = admin.storage.from(BUCKET);

  // Atomically consume the intent: only the requester, only once, only before expiry.
  const { data: intent } = await admin
    .from("upload_intents")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", parsed.data.intentId)
    .eq("requested_by", ctx.userId)
    .is("consumed_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("*")
    .maybeSingle();
  if (!intent) return apiError("intent_invalid", 409);

  const reject = async (code: ApiErrorCode, reason: string, status = 422) => {
    await storage.remove([intent.storage_path]);
    await audit(
      {
        actorId: ctx.userId,
        action: "file.upload_rejected",
        targetType: "user",
        targetId: intent.owner_id,
        metadata: { reason, declared_mime: intent.declared_mime, declared_size: intent.declared_size },
      },
      meta,
    );
    return apiError(code, status);
  };

  const { data: blob, error: downloadError } = await storage.download(intent.storage_path);
  if (downloadError || !blob) return reject("upload_missing", "object_missing", 409);

  const buf = new Uint8Array(await blob.arrayBuffer());
  if (buf.byteLength === 0) return reject("empty_file", "empty");
  if (buf.byteLength !== intent.declared_size || buf.byteLength > MAX_FILE_BYTES) return reject("size_mismatch", "size_mismatch");
  if (blob.type && blob.type.split(";")[0] !== intent.declared_mime) return reject("content_rejected", "content_type_mismatch");

  const kind = kindFromMime(intent.declared_mime);
  if (!kind) return reject("type_not_allowed", "mime_not_allowed");

  const inspection = inspectFile(buf, kind);
  if (!inspection.ok) return reject("content_rejected", inspection.reason);

  const checksum = sha256Hex(buf);

  const { data: usage } = await admin.rpc("storage_usage", { p_owner: intent.owner_id }).single();
  if (!usage || usage.used_bytes + buf.byteLength > usage.quota_bytes) return reject("quota_exceeded", "quota");

  const finalPath = `${intent.owner_id}/${crypto.randomUUID()}`;
  const { error: moveError } = await storage.move(intent.storage_path, finalPath);
  if (moveError) {
    console.error("[upload] move failed");
    return reject("server_error", "move_failed", 500);
  }

  const { data: file, error: insertError } = await admin
    .from("files")
    .insert({
      owner_id: intent.owner_id,
      uploaded_by: ctx.userId,
      category_id: intent.category_id,
      original_name: intent.original_name,
      description: intent.description,
      storage_path: finalPath,
      mime_type: intent.declared_mime,
      size_bytes: buf.byteLength,
      checksum_sha256: checksum,
    })
    .select("id")
    .single();
  if (insertError || !file) {
    console.error(`[upload] files insert failed: ${insertError?.code ?? "none"}`);
    await storage.remove([finalPath]);
    return apiError("server_error", 500);
  }

  await audit(
    {
      actorId: ctx.userId,
      action: "file.uploaded",
      targetType: "file",
      targetId: file.id,
      metadata: {
        owner_id: intent.owner_id,
        original_name: intent.original_name,
        mime_type: intent.declared_mime,
        size_bytes: buf.byteLength,
        on_behalf: intent.owner_id !== ctx.userId,
      },
    },
    meta,
  );

  if (intent.owner_id !== ctx.userId) {
    after(async () => {
      try {
        await sendFileAssignedEmail(intent.owner_id, intent.original_name);
      } catch {
        console.error("[upload] owner notification failed");
      }
    });
  }

  return apiOk({ id: file.id }, 201);
}
