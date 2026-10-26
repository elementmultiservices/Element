import "server-only";
import { NextResponse } from "next/server";
import type { AuthorizationFailure } from "@/lib/auth/session";

/** Error codes returned to the browser. Generic by design; details stay in server logs. */
export type ApiErrorCode =
  | "unauthorized"
  | "forbidden"
  | "upload_not_allowed"
  | "mfa_required"
  | "bad_request"
  | "recaptcha_failed"
  | "rate_limited"
  | "daily_cap"
  | "invalid_name"
  | "double_extension"
  | "type_not_allowed"
  | "not_previewable"
  | "too_large"
  | "empty_file"
  | "quota_exceeded"
  | "invalid_category"
  | "invalid_owner"
  | "intent_invalid"
  | "upload_missing"
  | "size_mismatch"
  | "content_rejected"
  | "not_found"
  | "intake_limit"
  | "intake_invalid"
  | "intake_uploads_invalid"
  | "form_expired"
  | "server_error";

const noStore = { "Cache-Control": "private, no-store" };

export function apiError(code: ApiErrorCode, status: number): NextResponse {
  return NextResponse.json({ error: code }, { status, headers: noStore });
}

export function apiOk<T extends object>(body: T, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: noStore });
}

export function authFailure(reason: AuthorizationFailure): NextResponse {
  if (reason === "mfa_required") return apiError("mfa_required", 403);
  if (reason === "forbidden") return apiError("forbidden", 403);
  return apiError("unauthorized", 401);
}
