import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk, authFailure } from "@/lib/api";
import { audit } from "@/lib/audit";
import { authorize } from "@/lib/auth/session";
import { BLOG_TAG, COVER_BUCKET } from "@/lib/blog/queries";
import { rateLimit } from "@/lib/security/rate-limit";
import { isSameOrigin } from "@/lib/security/origin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const MAX_COVER_BYTES = 4 * 1024 * 1024; // under the 4.5 MB platform body limit

type ImageType = { ext: "jpg" | "png" | "webp"; mime: string };

/** Identifies the image by its magic bytes; the declared type is ignored. */
function detectImage(buf: Uint8Array): ImageType | null {
  const at = (i: number) => buf[i] ?? -1;
  if (at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return { ext: "jpg", mime: "image/jpeg" };
  if ([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => at(i) === b)) return { ext: "png", mime: "image/png" };
  const ascii = (from: number, to: number) => String.fromCharCode(...buf.subarray(from, to));
  if (buf.length > 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return { ext: "webp", mime: "image/webp" };
  return null;
}

async function authorizeAdmin(request: NextRequest, params: Promise<{ id: string }>) {
  if (!isSameOrigin(request)) return { response: apiError("forbidden", 403) } as const;
  const auth = await authorize({ role: "admin" });
  if (!auth.ok) return { response: authFailure(auth.reason) } as const;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return { response: apiError("not_found", 404) } as const;
  if (!(await rateLimit("coverUploadUser", auth.ctx.userId)).success) return { response: apiError("rate_limited", 429) } as const;
  const supabase = await createClient();
  const { data: post } = await supabase.from("posts").select("id, cover_path").eq("id", id).maybeSingle();
  if (!post) return { response: apiError("not_found", 404) } as const;
  return { adminId: auth.ctx.userId, post, supabase } as const;
}

/** Replaces the cover image of a post (multipart/form-data, field "file"). */
export async function POST(request: NextRequest, { params }: RouteContext<"/api/admin/blog/[id]/cover">) {
  const ctx = await authorizeAdmin(request, params);
  if ("response" in ctx) return ctx.response;

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_COVER_BYTES + 64 * 1024) return apiError("too_large", 413);

  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return apiError("bad_request", 400);
  }
  if (!(file instanceof File) || file.size === 0) return apiError("bad_request", 400);
  if (file.size > MAX_COVER_BYTES) return apiError("too_large", 413);

  const buf = new Uint8Array(await file.arrayBuffer());
  const type = detectImage(buf);
  if (!type) return apiError("type_not_allowed", 422);

  const path = `${ctx.post.id}/${crypto.randomUUID()}.${type.ext}`;
  const storage = createAdminClient().storage.from(COVER_BUCKET);
  const { error: uploadError } = await storage.upload(path, buf, { contentType: type.mime, upsert: false, cacheControl: "31536000" });
  if (uploadError) {
    console.error("[blog] cover upload failed");
    return apiError("server_error", 500);
  }

  const { error } = await ctx.supabase.from("posts").update({ cover_path: path }).eq("id", ctx.post.id);
  if (error) {
    await storage.remove([path]);
    console.error(`[blog] cover update failed: ${error.code}`);
    return apiError("server_error", 500);
  }
  revalidateTag(BLOG_TAG, { expire: 0 });
  if (ctx.post.cover_path) await storage.remove([ctx.post.cover_path]);

  await audit({ actorId: ctx.adminId, action: "post.cover_updated", targetType: "post", targetId: ctx.post.id, metadata: { size_bytes: buf.byteLength, type: type.ext } });
  return apiOk({ coverPath: path });
}

export async function DELETE(request: NextRequest, { params }: RouteContext<"/api/admin/blog/[id]/cover">) {
  const ctx = await authorizeAdmin(request, params);
  if ("response" in ctx) return ctx.response;
  if (!ctx.post.cover_path) return apiOk({ coverPath: null });

  const { error } = await ctx.supabase.from("posts").update({ cover_path: null }).eq("id", ctx.post.id);
  if (error) return apiError("server_error", 500);
  revalidateTag(BLOG_TAG, { expire: 0 });
  await createAdminClient().storage.from(COVER_BUCKET).remove([ctx.post.cover_path]);

  await audit({ actorId: ctx.adminId, action: "post.cover_removed", targetType: "post", targetId: ctx.post.id });
  return apiOk({ coverPath: null });
}
