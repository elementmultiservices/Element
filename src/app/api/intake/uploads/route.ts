import type { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api";
import { checkFileName, MAX_FILE_BYTES } from "@/lib/files/rules";
import { actorColumn, actorFolder, intakeActor } from "@/lib/intake/actor";
import { INTAKE_BUCKET } from "@/lib/intake/storage";
import { intakeUploadIntentSchema, MAX_INTAKE_UPLOADS } from "@/lib/intake/schema";
import { rateLimit } from "@/lib/security/rate-limit";
import { isSameOrigin } from "@/lib/security/origin";
import { verifyRecaptcha } from "@/lib/security/recaptcha";
import { requestMeta } from "@/lib/security/request-meta";
import { createAdminClient } from "@/lib/supabase/admin";

/** Unsubmitted documents are kept for a day, then removed by the purge-trash function. */
const PENDING_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Step 1 of an intake document upload: validates the file name, type and size,
 * records a pending intake upload and returns a signed upload URL for a random
 * path. Any active account may attach documents to its own intake form; on the
 * public form (draft token, no account) each file also needs reCAPTCHA and
 * stricter per-IP limits, since it stores data for someone we do not know.
 */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return apiError("forbidden", 403);

  const found = await intakeActor(request);
  if ("response" in found) return found.response;
  const { actor } = found;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("bad_request", 400);
  }
  const parsed = intakeUploadIntentSchema.safeParse(body);
  if (!parsed.success) return apiError("bad_request", 400);
  const input = parsed.data;

  const { ip } = await requestMeta();
  if (actor.kind === "user") {
    if (!(await rateLimit("intakeUploadUser", actor.userId)).success) return apiError("rate_limited", 429);
  } else {
    if (!(await rateLimit("intakePublicUploadIp", ip)).success) return apiError("rate_limited", 429);
    if (!(await verifyRecaptcha(input.recaptchaToken, "intake_upload", ip))) return apiError("recaptcha_failed", 403);
  }

  const nameCheck = checkFileName(input.name);
  if (!nameCheck.ok) {
    const code = nameCheck.reason === "doubleExtension" ? "double_extension" : nameCheck.reason === "invalidName" ? "invalid_name" : "type_not_allowed";
    return apiError(code, 422);
  }
  if (input.mime !== nameCheck.mime) return apiError("type_not_allowed", 422);
  if (input.size === 0) return apiError("empty_file", 422);
  if (input.size > MAX_FILE_BYTES) return apiError("too_large", 422);

  const admin = createAdminClient();
  const [column, value] = actorColumn(actor);
  const { count } = await admin
    .from("intake_uploads")
    .select("id", { count: "exact", head: true })
    .eq(column, value)
    .is("submission_id", null)
    .gt("expires_at", new Date().toISOString());
  if ((count ?? 0) >= MAX_INTAKE_UPLOADS) return apiError("intake_limit", 422);

  const daily = actor.kind === "user" ? await rateLimit("intakeUploadDailyUser", actor.userId) : await rateLimit("intakePublicUploadDailyIp", ip);
  if (!daily.success) return apiError("daily_cap", 429);

  const storagePath = `${actorFolder(actor)}/${crypto.randomUUID()}`;
  const { data: upload, error } = await admin
    .from("intake_uploads")
    .insert({
      owner_id: actor.kind === "user" ? actor.userId : null,
      draft_id: actor.kind === "draft" ? actor.draftId : null,
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
