import type { NextRequest } from "next/server";
import { apiError, apiOk, authFailure } from "@/lib/api";
import { authorize } from "@/lib/auth/session";
import { checkFileName, MAX_FILE_BYTES } from "@/lib/files/rules";
import { rateLimit } from "@/lib/security/rate-limit";
import { verifyRecaptcha } from "@/lib/security/recaptcha";
import { isSameOrigin } from "@/lib/security/origin";
import { clientIpFrom } from "@/lib/security/request-meta";
import { createAdminClient } from "@/lib/supabase/admin";
import { uploadIntentSchema } from "@/lib/validation/files";

const INTENT_TTL_MS = 15 * 60 * 1000;

/**
 * Step 1 of the upload flow. Validates session, origin, reCAPTCHA, rate limits,
 * name/extension/MIME, size, category and remaining quota, then records an
 * upload intent and returns a signed upload URL for a random pending path.
 * The file itself goes straight from the browser to Supabase Storage.
 */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return apiError("forbidden", 403);

  const auth = await authorize();
  if (!auth.ok) return authFailure(auth.reason);
  const { ctx } = auth;
  const ip = clientIpFrom(request.headers);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("bad_request", 400);
  }
  const parsed = uploadIntentSchema.safeParse(body);
  if (!parsed.success) return apiError("bad_request", 400);
  const input = parsed.data;

  if (!(await verifyRecaptcha(input.recaptchaToken, "upload", ip))) return apiError("recaptcha_failed", 403);
  if (!(await rateLimit("uploadIntentIp", ip)).success) return apiError("rate_limited", 429);
  if (!(await rateLimit("uploadIntentUser", ctx.userId)).success) return apiError("rate_limited", 429);

  // Name, extension and MIME must agree with the allowlist.
  const nameCheck = checkFileName(input.name);
  if (!nameCheck.ok) {
    const code = nameCheck.reason === "doubleExtension" ? "double_extension" : nameCheck.reason === "invalidName" ? "invalid_name" : "type_not_allowed";
    return apiError(code, 422);
  }
  if (input.mime !== nameCheck.mime) return apiError("type_not_allowed", 422);
  if (input.size === 0) return apiError("empty_file", 422);
  if (input.size > MAX_FILE_BYTES) return apiError("too_large", 422);

  const admin = createAdminClient();

  // Owner: the caller, or (admins only) the user the file is uploaded for.
  let ownerId = ctx.userId;
  if (input.ownerId && input.ownerId !== ctx.userId) {
    if (ctx.role !== "admin") return apiError("forbidden", 403);
    const { data: owner } = await admin.from("profiles").select("id, is_active").eq("id", input.ownerId).maybeSingle();
    if (!owner?.is_active) return apiError("invalid_owner", 422);
    ownerId = owner.id;
  }

  if (input.categoryId) {
    const { data: category } = await admin
      .from("file_categories")
      .select("id")
      .eq("id", input.categoryId)
      .eq("is_archived", false)
      .maybeSingle();
    if (!category) return apiError("invalid_category", 422);
  }

  const { data: usage, error: usageError } = await admin.rpc("storage_usage", { p_owner: ownerId }).single();
  if (usageError || !usage) {
    console.error(`[upload] storage_usage failed: ${usageError?.code ?? "none"}`);
    return apiError("server_error", 500);
  }
  if (usage.used_bytes + usage.pending_bytes + input.size > usage.quota_bytes) return apiError("quota_exceeded", 422);

  // Daily cap is counted per authorized upload attempt.
  if (!(await rateLimit("uploadDailyUser", ctx.userId)).success) return apiError("daily_cap", 429);

  const storagePath = `pending/${crypto.randomUUID()}`;
  const { data: intent, error: intentError } = await admin
    .from("upload_intents")
    .insert({
      requested_by: ctx.userId,
      owner_id: ownerId,
      storage_path: storagePath,
      original_name: input.name.normalize("NFC"),
      description: input.description,
      category_id: input.categoryId ?? null,
      declared_mime: nameCheck.mime,
      declared_size: input.size,
      expires_at: new Date(Date.now() + INTENT_TTL_MS).toISOString(),
    })
    .select("id")
    .single();
  if (intentError || !intent) {
    console.error(`[upload] intent insert failed: ${intentError?.code ?? "none"}`);
    return apiError("server_error", 500);
  }

  const { data: signed, error: signError } = await admin.storage.from("files").createSignedUploadUrl(storagePath);
  if (signError || !signed) {
    console.error("[upload] signed upload URL failed");
    await admin.from("upload_intents").delete().eq("id", intent.id);
    return apiError("server_error", 500);
  }

  return apiOk({ intentId: intent.id, uploadUrl: signed.signedUrl, contentType: nameCheck.mime }, 201);
}
