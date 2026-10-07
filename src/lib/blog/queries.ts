import "server-only";
import type { AppLocale } from "@/i18n/routing";
import { publicEnv } from "@/lib/public-env";
import { createPublicClient } from "@/lib/supabase/public";
import type { ServerSupabaseClient } from "@/lib/supabase/server";

export const BLOG_PAGE_SIZE = 9;
export const COVER_BUCKET = "blog-covers";

export function coverUrl(path: string | null): string | null {
  if (!path) return null;
  return `${publicEnv.supabaseUrl}/storage/v1/object/public/${COVER_BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

// ---------------------------------------------------------------------------
// Public (anonymous client; visibility enforced in SQL)
// ---------------------------------------------------------------------------
export type PostSummary = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  coverPath: string | null;
  publishedAt: string;
  category: { name: string; slug: string } | null;
};

export async function listPublishedPosts(
  locale: AppLocale,
  options: { category?: string; page?: number; limit?: number } = {},
): Promise<{ posts: PostSummary[]; total: number; pageCount: number; page: number }> {
  const limit = options.limit ?? BLOG_PAGE_SIZE;
  const page = Math.max(1, options.page ?? 1);
  const { data, error } = await createPublicClient().rpc("blog_list", {
    p_locale: locale,
    p_category: options.category ?? undefined,
    p_limit: limit,
    p_offset: (page - 1) * limit,
  });
  if (error) throw new Error(`[blog] list failed: ${error.code}`);
  const rows = data ?? [];
  const total = rows[0]?.total_count ?? 0;
  return {
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / limit)),
    posts: rows.map((r) => ({
      id: r.post_id,
      title: r.title,
      slug: r.slug,
      excerpt: r.excerpt,
      coverPath: r.cover_path,
      publishedAt: r.published_at,
      category: r.category_name && r.category_slug ? { name: r.category_name, slug: r.category_slug } : null,
    })),
  };
}

export type PublicPost = {
  id: string;
  title: string | null;
  slug: string | null;
  excerpt: string;
  content: string;
  coverPath: string | null;
  publishedAt: string;
  updatedAt: string;
  category: { name: string; slug: string } | null;
  slugs: Partial<Record<AppLocale, string>>;
};

export async function getPublishedPost(locale: AppLocale, slug: string): Promise<PublicPost | null> {
  const { data, error } = await createPublicClient().rpc("blog_post", { p_locale: locale, p_slug: slug }).maybeSingle();
  if (error) throw new Error(`[blog] post failed: ${error.code}`);
  if (!data) return null;
  const slugs = (data.slugs ?? {}) as Partial<Record<AppLocale, string>>;
  return {
    id: data.post_id,
    title: data.title,
    slug: data.slug,
    excerpt: data.excerpt ?? "",
    content: data.content ?? "",
    coverPath: data.cover_path,
    publishedAt: data.published_at,
    updatedAt: data.updated_at,
    category: data.category_name && data.category_slug ? { name: data.category_name, slug: data.category_slug } : null,
    slugs,
  };
}

export async function listPublicCategories(locale: AppLocale): Promise<{ name: string; slug: string; count: number }[]> {
  const { data, error } = await createPublicClient().rpc("blog_categories", { p_locale: locale });
  if (error) throw new Error(`[blog] categories failed: ${error.code}`);
  return (data ?? []).map((c) => ({ name: c.name, slug: c.slug, count: c.post_count }));
}

export async function sitemapPosts(): Promise<{ slugs: Partial<Record<AppLocale, string>>; updatedAt: string }[]> {
  const { data, error } = await createPublicClient().rpc("blog_sitemap");
  if (error) return [];
  return (data ?? []).map((r) => ({ slugs: (r.slugs ?? {}) as Partial<Record<AppLocale, string>>, updatedAt: r.updated_at }));
}

// ---------------------------------------------------------------------------
// Admin (admin's own session; RLS admin policies)
// ---------------------------------------------------------------------------
export type PostStatus = "draft" | "scheduled" | "published";

export type AdminTranslation = { title: string; slug: string; excerpt: string; content: string };

export type AdminPost = {
  id: string;
  status: PostStatus;
  publishedAt: string | null;
  categoryId: string | null;
  coverPath: string | null;
  createdAt: string;
  updatedAt: string;
  translations: Partial<Record<AppLocale, AdminTranslation>>;
};

const ADMIN_POST_COLUMNS =
  "id, status, published_at, category_id, cover_path, created_at, updated_at, post_translations(locale, title, slug, excerpt, content)" as const;

type AdminPostRow = {
  id: string;
  status: PostStatus;
  published_at: string | null;
  category_id: string | null;
  cover_path: string | null;
  created_at: string;
  updated_at: string;
  post_translations: { locale: AppLocale; title: string; slug: string; excerpt: string; content: string }[];
};

function toAdminPost(r: AdminPostRow): AdminPost {
  const translations: Partial<Record<AppLocale, AdminTranslation>> = {};
  for (const t of r.post_translations) translations[t.locale] = { title: t.title, slug: t.slug, excerpt: t.excerpt, content: t.content };
  return {
    id: r.id,
    status: r.status,
    publishedAt: r.published_at,
    categoryId: r.category_id,
    coverPath: r.cover_path,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    translations,
  };
}

/** Effective status: a scheduled post whose time has come is already public. */
export function effectiveStatus(post: Pick<AdminPost, "status" | "publishedAt">): PostStatus {
  if (post.status === "scheduled" && post.publishedAt && new Date(post.publishedAt) <= new Date()) return "published";
  return post.status;
}

export async function listAdminPosts(
  supabase: ServerSupabaseClient,
  params: { status?: PostStatus; q?: string; page: number },
  pageSize = 25,
): Promise<{ rows: AdminPost[]; total: number; page: number; pageCount: number }> {
  let query = supabase.from("posts").select(ADMIN_POST_COLUMNS, { count: "exact" });
  if (params.status) query = query.eq("status", params.status);
  if (params.q) {
    const pattern = `%${params.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const { data: matches } = await supabase.from("post_translations").select("post_id").ilike("title", pattern).limit(500);
    const ids = [...new Set((matches ?? []).map((m) => m.post_id))];
    if (ids.length === 0) return { rows: [], total: 0, page: 1, pageCount: 1 };
    query = query.in("id", ids);
  }
  const from = (params.page - 1) * pageSize;
  const { data, count, error } = await query
    .order("updated_at", { ascending: false })
    .order("id", { ascending: true })
    .range(from, from + pageSize - 1);
  if (error && error.code !== "PGRST103") throw new Error(`[blog] admin list failed: ${error.code}`);
  const total = count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  return { rows: ((data ?? []) as AdminPostRow[]).map(toAdminPost), total, page: Math.min(params.page, pageCount), pageCount };
}

export async function getAdminPost(supabase: ServerSupabaseClient, id: string): Promise<AdminPost | null> {
  const { data, error } = await supabase.from("posts").select(ADMIN_POST_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`[blog] admin get failed: ${error.code}`);
  return data ? toAdminPost(data as AdminPostRow) : null;
}

export type AdminPostCategory = { id: string; nameEn: string; nameEs: string; slugEn: string; slugEs: string; postCount: number };

export async function listPostCategories(supabase: ServerSupabaseClient): Promise<AdminPostCategory[]> {
  const { data, error } = await supabase
    .from("post_categories")
    .select("id, name_en, name_es, slug_en, slug_es, posts(count)")
    .order("name_en");
  if (error) throw new Error(`[blog] categories failed: ${error.code}`);
  return (data ?? []).map((c) => ({
    id: c.id,
    nameEn: c.name_en,
    nameEs: c.name_es,
    slugEn: c.slug_en,
    slugEs: c.slug_es,
    postCount: (c.posts as unknown as { count: number }[])[0]?.count ?? 0,
  }));
}
