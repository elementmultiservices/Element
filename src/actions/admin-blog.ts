"use server";

import type { AppLocale } from "@/i18n/routing";
import { locales } from "@/i18n/routing";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/session";
import { COVER_BUCKET, isNotMigrated } from "@/lib/blog/queries";
import { plainText, sanitizePostHtml } from "@/lib/blog/sanitize";
import { slugify } from "@/lib/blog/slug";
import type { FormState, ValidationKey } from "@/lib/forms";
import { fieldErrorsFrom } from "@/lib/forms";
import { rateLimit } from "@/lib/security/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { idSchema } from "@/lib/validation/admin";
import { postCategorySchema, postMetaSchema, translationInputSchema, type TranslationInput } from "@/lib/validation/blog";

type TranslationField = "title" | "slug" | "excerpt" | "content";
export type PostField = `${AppLocale}.${TranslationField}` | "status" | "publishedAt" | "categoryId" | "kind" | "featured" | "sourceUrl" | "translations";
export type PostState = FormState<PostField> & { postId?: string };

const UNIQUE_VIOLATION = "23505";

function str(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

/**
 * Creates or updates a post with its translations in one transaction
 * (admin_save_post). HTML is sanitized here, before storage, and again when
 * rendered. A translation left completely empty is removed.
 */
export async function savePostAction(_prev: PostState, formData: FormData): Promise<PostState> {
  const session = await requireAdmin();
  if (!(await rateLimit("adminActionUser", session.userId)).success) return { status: "error", error: "rateLimited" };

  const fieldErrors: Partial<Record<PostField, ValidationKey>> = {};

  const meta = postMetaSchema.safeParse({
    id: str(formData, "id") || undefined,
    status: str(formData, "status"),
    publishedAt: str(formData, "publishedAt"),
    categoryId: str(formData, "categoryId"),
    kind: str(formData, "kind") || undefined,
    featured: formData.get("featured") ?? undefined,
    sourceUrl: str(formData, "sourceUrl"),
  });
  if (!meta.success) {
    Object.assign(fieldErrors, fieldErrorsFrom<PostField>(meta.error));
    return { status: "error", fieldErrors };
  }

  const translations: Partial<Record<AppLocale, TranslationInput>> = {};
  for (const locale of locales) {
    const raw = {
      title: str(formData, `${locale}.title`),
      slug: str(formData, `${locale}.slug`),
      excerpt: str(formData, `${locale}.excerpt`),
      content: sanitizePostHtml(str(formData, `${locale}.content`)),
    };
    const empty = !raw.title.trim() && !raw.slug.trim() && !raw.excerpt.trim() && plainText(raw.content) === "";
    if (empty) continue;

    if (!raw.slug.trim()) raw.slug = slugify(raw.title);
    const parsed = translationInputSchema.safeParse(raw);
    if (!parsed.success) {
      for (const [field, key] of Object.entries(fieldErrorsFrom<TranslationField>(parsed.error))) {
        fieldErrors[`${locale}.${field as TranslationField}`] = key;
      }
      continue;
    }
    if (plainText(parsed.data.content) === "") {
      fieldErrors[`${locale}.content`] = "contentRequired";
      continue;
    }
    translations[locale] = parsed.data;
  }

  if (Object.keys(translations).length === 0 && Object.keys(fieldErrors).length === 0) {
    fieldErrors.translations = "translationRequired";
  }

  // Publication date rules (Bogotá time is applied by the schema).
  const { status, publishedAt, categoryId, id, kind, featured, sourceUrl } = meta.data;
  let publishAt: Date | null = publishedAt instanceof Date ? publishedAt : null;
  if (status === "scheduled") {
    if (!publishAt) fieldErrors.publishedAt = "dateRequired";
    else if (publishAt <= new Date()) fieldErrors.publishedAt = "scheduleFuture";
  } else if (status === "published") {
    if (!publishAt || publishAt > new Date()) publishAt = new Date();
  }

  if (Object.keys(fieldErrors).length > 0) return { status: "error", fieldErrors };

  const supabase = await createClient();
  const before = id ? (await supabase.from("posts").select("status").eq("id", id).maybeSingle()).data : null;
  if (id && !before) return { status: "error", error: "notFound" };

  const base = {
    p_id: id ?? undefined,
    p_status: status,
    p_published_at: publishAt ? publishAt.toISOString() : undefined,
    p_category_id: categoryId ? categoryId : undefined,
    p_translations: translations,
  };
  let { data: postId, error } = await supabase.rpc("admin_save_post_v2", {
    ...base,
    p_kind: kind,
    p_featured: featured,
    p_source_url: sourceUrl || undefined,
  });
  if (error && isNotMigrated(error.code)) {
    // Migration pending: plain articles can still be saved with the original function.
    if (kind !== "article" || featured || sourceUrl) return { status: "error", error: "migrationPending" };
    ({ data: postId, error } = await supabase.rpc("admin_save_post", base));
  }

  if (error || !postId) {
    if (error?.code === UNIQUE_VIOLATION) {
      // Find which language's slug is taken by another post (error formats vary by client).
      const taken: Partial<Record<PostField, ValidationKey>> = {};
      for (const [locale, tr] of Object.entries(translations) as [AppLocale, TranslationInput][]) {
        let q = supabase.from("post_translations").select("post_id").eq("locale", locale).eq("slug", tr.slug);
        if (id) q = q.neq("post_id", id);
        const { data: clash } = await q.limit(1);
        if (clash && clash.length > 0) taken[`${locale}.slug`] = "slugTaken";
      }
      return Object.keys(taken).length > 0 ? { status: "error", fieldErrors: taken } : { status: "error", error: "generic" };
    }
    if (error?.message.includes("not_found")) return { status: "error", error: "notFound" };
    console.error(`[blog] save failed: ${error?.code ?? "none"}`);
    return { status: "error", error: "generic" };
  }

  const title = translations.en?.title ?? translations.es?.title ?? "";
  await audit({
    actorId: session.userId,
    action: !id ? "post.created" : before?.status !== "published" && status === "published" ? "post.published" : "post.updated",
    targetType: "post",
    targetId: postId,
    metadata: { status, kind, featured, locales: Object.keys(translations), title },
  });
  return { status: "success", postId };
}

export async function deletePostAction(_prev: FormState<never>, formData: FormData): Promise<FormState<never>> {
  const session = await requireAdmin();
  if (!(await rateLimit("adminActionUser", session.userId)).success) return { status: "error", error: "rateLimited" };
  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { status: "error", error: "notFound" };

  const supabase = await createClient();
  const { data: post } = await supabase
    .from("posts")
    .select("id, cover_path, post_translations(title)")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!post) return { status: "error", error: "notFound" };

  const { error } = await supabase.from("posts").delete().eq("id", post.id);
  if (error) {
    console.error(`[blog] delete failed: ${error.code}`);
    return { status: "error", error: "generic" };
  }
  if (post.cover_path) await createAdminClient().storage.from(COVER_BUCKET).remove([post.cover_path]);

  await audit({
    actorId: session.userId,
    action: "post.deleted",
    targetType: "post",
    targetId: post.id,
    metadata: { title: post.post_translations.map((t) => t.title).join(" / ") },
  });
  return { status: "success" };
}

// ---------------------------------------------------------------------------
// Blog categories
// ---------------------------------------------------------------------------
export type PostCategoryField = "nameEn" | "nameEs" | "slugEn" | "slugEs";

export async function savePostCategoryAction(
  _prev: FormState<PostCategoryField>,
  formData: FormData,
): Promise<FormState<PostCategoryField>> {
  const session = await requireAdmin();
  if (!(await rateLimit("adminActionUser", session.userId)).success) return { status: "error", error: "rateLimited" };

  const nameEn = str(formData, "nameEn");
  const nameEs = str(formData, "nameEs");
  const parsed = postCategorySchema.safeParse({
    id: str(formData, "id") || undefined,
    nameEn,
    nameEs,
    slugEn: str(formData, "slugEn").trim() || slugify(nameEn),
    slugEs: str(formData, "slugEs").trim() || slugify(nameEs),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom<PostCategoryField>(parsed.error) };
  const { id, ...values } = parsed.data;
  const row = { name_en: values.nameEn, name_es: values.nameEs, slug_en: values.slugEn, slug_es: values.slugEs };

  const supabase = await createClient();
  const { data, error } = id
    ? await supabase.from("post_categories").update(row).eq("id", id).select("id").maybeSingle()
    : await supabase.from("post_categories").insert(row).select("id").single();
  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      const field: PostCategoryField = (error.message ?? "").includes("slug_es") ? "slugEs" : "slugEn";
      return { status: "error", fieldErrors: { [field]: "slugTaken" } };
    }
    console.error(`[blog] category save failed: ${error.code}`);
    return { status: "error", error: "generic" };
  }
  if (!data) return { status: "error", error: "notFound" };

  await audit({
    actorId: session.userId,
    action: id ? "post_category.updated" : "post_category.created",
    targetType: "post_category",
    targetId: data.id,
    metadata: { name: `${values.nameEn} / ${values.nameEs}` },
  });
  return { status: "success" };
}

export async function deletePostCategoryAction(_prev: FormState<never>, formData: FormData): Promise<FormState<never>> {
  const session = await requireAdmin();
  if (!(await rateLimit("adminActionUser", session.userId)).success) return { status: "error", error: "rateLimited" };
  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { status: "error", error: "notFound" };

  const supabase = await createClient();
  const { data, error } = await supabase.from("post_categories").delete().eq("id", parsed.data.id).select("id, name_en, name_es").maybeSingle();
  if (error) {
    console.error(`[blog] category delete failed: ${error.code}`);
    return { status: "error", error: "generic" };
  }
  if (!data) return { status: "error", error: "notFound" };

  await audit({
    actorId: session.userId,
    action: "post_category.deleted",
    targetType: "post_category",
    targetId: data.id,
    metadata: { name: `${data.name_en} / ${data.name_es}` },
  });
  return { status: "success" };
}
