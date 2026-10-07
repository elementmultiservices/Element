import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, authFailure } from "@/lib/api";
import { audit } from "@/lib/audit";
import { authorize } from "@/lib/auth/session";
import { sanitizeDownloadName } from "@/lib/files/rules";
import { rateLimit } from "@/lib/security/rate-limit";
import { requestMeta } from "@/lib/security/request-meta";
import { createClient } from "@/lib/supabase/server";

const SIGNED_URL_TTL_SECONDS = 60;

/**
 * Downloads go through this route: permissions are checked with the user's own
 * client (RLS on the files table AND on storage.objects), then the browser is
 * redirected to a 60-second signed URL served as an attachment.
 */
export async function GET(_request: NextRequest, { params }: RouteContext<"/api/files/[id]/download">) {
  const auth = await authorize();
  if (!auth.ok) return authFailure(auth.reason);
  const { ctx } = auth;
  const meta = await requestMeta();

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return apiError("not_found", 404);

  if (!(await rateLimit("downloadIp", meta.ip)).success) return apiError("rate_limited", 429);
  if (!(await rateLimit("downloadUser", ctx.userId)).success) return apiError("rate_limited", 429);

  const supabase = await createClient();
  const { data: file } = await supabase
    .from("files")
    .select("id, owner_id, original_name, storage_path, size_bytes")
    .eq("id", id)
    .maybeSingle();
  if (!file) return apiError("not_found", 404);

  const { data: signed, error } = await supabase.storage
    .from("files")
    .createSignedUrl(file.storage_path, SIGNED_URL_TTL_SECONDS, { download: sanitizeDownloadName(file.original_name) });
  if (error || !signed) return apiError("not_found", 404);

  await audit(
    { actorId: ctx.userId, action: "file.downloaded", targetType: "file", targetId: file.id, metadata: { owner_id: file.owner_id } },
    meta,
  );

  const response = NextResponse.redirect(signed.signedUrl, 303);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
