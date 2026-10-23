import "server-only";
import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";

/** Intake objects share the private "files" bucket, under intake/<owner>/… */
export const INTAKE_BUCKET = "files";

const SIGNED_URL_TTL_SECONDS = 60;

/**
 * Redirects to a 60-second signed URL for an intake object. Callers must have
 * checked access first (RLS read of the row with the user's own client): the
 * storage policies only cover the files table, so the URL is signed with the
 * service role.
 */
export async function redirectToIntakeObject(path: string, downloadName?: string): Promise<NextResponse> {
  const { data: signed, error } = await createAdminClient()
    .storage.from(INTAKE_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS, downloadName ? { download: downloadName } : undefined);
  if (error || !signed) return apiError("not_found", 404);

  const response = NextResponse.redirect(signed.signedUrl, 303);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

/** Downloads an intake object's bytes (service role), or null. */
export async function readIntakeObject(path: string): Promise<Uint8Array | null> {
  const { data, error } = await createAdminClient().storage.from(INTAKE_BUCKET).download(path);
  if (error || !data) return null;
  return new Uint8Array(await data.arrayBuffer());
}
