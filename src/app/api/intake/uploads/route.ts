import type { NextRequest } from "next/server";
import { apiError, apiOk, authFailure } from "@/lib/api";
import { authorize } from "@/lib/auth/session";
import { checkFileName, MAX_FILE_BYTES } from "@/lib/files/rules";
import { INTAKE_BUCKET } from "@/lib/intake/storage";
import { intakeUploadIntentSchema, MAX_INTAKE_UPLOADS } from "@/lib/intake/schema";
import { rateLimit } from "@/lib/security/rate-limit";
import { isSameOrigin } from "@/lib/security/origin";
import { createAdminClient } from "@/lib/supabase/admin";

/** Unsubmitted documents are kept for a day, then removed by the purge-trash function. */
const PENDING_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Step 1 of an intake document upload: validates the file name, type and size,
 * records a pending intake upload and returns a signed upload URL for a random
 * path. Any active account may attach documents to its own intake form.
 */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return apiError("forbidden", 403);

  const auth = await authorize();
  if (!auth.ok) return authFailure(auth.reason);
  const { ctx } = auth;
  if (ctx.role !== "user") return apiError("forbidden", 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("bad_request", 400);
  }
  const parsed = intakeUploadIntentSchema.safeParse(body);
  if (!parsed.success) return apiError("bad_request", 400);
  const input = parsed.data;

  if (!(await rateLimit("intakeUploadUser", ctx.userId)).success) return apiError("rate_limited", 429);

  const nameCheck = checkFileName(input.name);
  if (!nameCheck.ok) {
    const code = nameCheck.reason === "doubleExtension" ? "double_extension" : nameCheck.reason === "invalidName" ? "invalid_name" : "type_not_allowed";
    return apiError(code, 422);
  }
  if (input.mime !== nameCheck.mime) return apiError("type_not_allowed", 422);
  if (input.size === 0) return apiError("empty_file", 422);
  if (input.size > MAX_FILE_BYTES) return apiError("too_large", 422);

  const admin = createAdminClient();
  const { count } = await admin
    .from("intake_uploads")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ctx.userId)
    .is("submission_id", null)
    .gt("expires_at", new Date().toISOString());
  if ((count ?? 0) >= MAX_INTAKE_UPLOADS) return apiError("intake_limit", 422);

  if (!(await rateLimit("intakeUploadDailyUser", ctx.userId)).success) return apiError("daily_cap", 429);

  const storagePath = `intake/${ctx.userId}/${crypto.randomUUID()}`;
  const { data: upload, error } = await admin
    .from("intake_uploads")
    .insert({
      owner_id: ctx.userId,
      doc_type: input.docType,
      original_name: input.name.normalize("NFC"),
      storage_path: storagePath,
      mime_type: nameCheck.mime,
      size_bytes: input.size,
      expires_at: new Date(Date.now() + PENDING_TTL_MS).toISOString(),
    })
    .select("id")
    .single();
  if (error || !upload) {
    console.error(`[intake] upload insert failed: ${error?.code ?? "none"}`);
    return apiError("server_error", 500);
  }

  const { data: signed, error: signError } = await admin.storage.from(INTAKE_BUCKET).createSignedUploadUrl(storagePath);
  if (signError || !signed) {
    console.error("[intake] signed upload URL failed");
    await admin.from("intake_uploads").delete().eq("id", upload.id);
    return apiError("server_error", 500);
  }

  return apiOk({ id: upload.id, uploadUrl: signed.signedUrl, contentType: nameCheck.mime }, 201);
}
