import "server-only";
import { unstable_cache } from "next/cache";
import type { AppLocale } from "@/i18n/routing";
import { publicEnv } from "@/lib/public-env";
import { createPublicClient } from "@/lib/supabase/public";
import type { ServerSupabaseClient } from "@/lib/supabase/server";

export const BLOG_PAGE_SIZE = 9;

export type PostKind = "article" | "update";
export const POST_KINDS = ["article", "update"] as const;

/**
 * PostgREST codes for "function / column / table does not exist": the blog
 * migration 20261013000100 has not been applied yet, so the original functions
 * are used and the new fields take their defaults.
 */
const NOT_MIGRATED = new Set(["PGRST202", "PGRST204", "PGRST205", "42883", "42703", "42P01"]);
export const isNotMigrated = (code: string | undefined) => !!code && NOT_MIGRATED.has(code);
export const COVER_BUCKET = "blog-covers";

/**
 * Covers go through Next.js image optimization (resized, WebP), except with a
 * local Supabase: the optimizer refuses loopback hosts.
 */
export const optimizeCovers = !/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(publicEnv.supabaseUrl);

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
  kind: PostKind;
  isFeatured: boolean;
  readingMinutes: number | null;
};

type FeedRow = {
  post_id: string;
  title: string;
  slug: string;
  excerpt: string;
  cover_path: string | null;
  published_at: string;
  category_name: string | null;
  category_slug: string | null;
  kind?: PostKind;
  is_featured?: boolean;
  reading_minutes?: number;
  total_count: number;
};

async function fetchPublishedPosts(
  locale: AppLocale,
  options: { category?: string; kind?: PostKind; page?: number; limit?: number } = {},
): Promise<{ posts: PostSummary[]; total: number; pageCount: number; page: number }> {
  const limit = options.limit ?? BLOG_PAGE_SIZE;
  const page = Math.max(1, options.page ?? 1);
  const client = createPublicClient();
  const args = { p_locale: locale, p_category: options.category ?? undefined, p_limit: limit, p_offset: (page - 1) * limit };
  let { data, error } = (await client.rpc("blog_feed", { ...args, p_kind: options.kind ?? undefined })) as {
    data: FeedRow[] | null;
    error: { code: string } | null;
  };
  if (error && isNotMigrated(error.code)) {
    // Before the migration there are no updates, only articles.
    ({ data, error } = options.kind === "update" ? { data: [], error: null } : await client.rpc("blog_list", args));
  }
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
      kind: r.kind ?? "article",
      isFeatured: r.is_featured ?? false,
      readingMinutes: r.reading_minutes ?? null,
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
  kind: PostKind;
  sourceUrl: string | null;
  readingMinutes: number | null;
};

type ArticleRow = {
  post_id: string;
  title: string | null;
  slug: string | null;
  excerpt: string | null;
  content: string | null;
  cover_path: string | null;
  published_at: string;
  updated_at: string;
  category_name: string | null;
  category_slug: string | null;
  slugs: unknown;
  kind?: PostKind;
  source_url?: string | null;
  reading_minutes?: number;
};

async function fetchPublishedPost(locale: AppLocale, slug: string): Promise<PublicPost | null> {
  const client = createPublicClient();
  const args = { p_locale: locale, p_slug: slug };
  let { data, error } = (await client.rpc("blog_article", args).maybeSingle()) as { data: ArticleRow | null; error: { code: string } | null };
  if (error && isNotMigrated(error.code)) ({ data, error } = await client.rpc("blog_post", args).maybeSingle());
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
    kind: data.kind ?? "article",
    sourceUrl: data.source_url ?? null,
    readingMinutes: data.reading_minutes ?? null,
  };
}

async function fetchPublicCategories(locale: AppLocale): Promise<{ name: string; slug: string; count: number }[]> {
  const { data, error } = await createPublicClient().rpc("blog_categories", { p_locale: locale });
  if (error) throw new Error(`[blog] categories failed: ${error.code}`);
  return (data ?? []).map((c) => ({ name: c.name, slug: c.slug, count: c.post_count }));
}

async function fetchSitemapPosts(): Promise<{ slugs: Partial<Record<AppLocale, string>>; updatedAt: string }[]> {
  const { data, error } = await createPublicClient().rpc("blog_sitemap");
  if (error) throw new Error(`[blog] sitemap failed: ${error.code}`);
  return (data ?? []).map((r) => ({ slugs: (r.slugs ?? {}) as Partial<Record<AppLocale, string>>, updatedAt: r.updated_at }));
}

/**
 * Public reads are shared across requests (the arguments are the cache key).
 * Admin changes expire BLOG_TAG; the short revalidate lets scheduled posts
 * appear on time. Errors throw, so they are never cached.
 */
export const BLOG_TAG = "blog";
const blogCache = { tags: [BLOG_TAG], revalidate: 60 };

export const listPublishedPosts = unstable_cache(fetchPublishedPosts, ["blog-feed"], blogCache);
export const getPublishedPost = unstable_cache(fetchPublishedPost, ["blog-post"], blogCache);
export const listPublicCategories = unstable_cache(fetchPublicCategories, ["blog-categories"], blogCache);
const cachedSitemapPosts = unstable_cache(fetchSitemapPosts, ["blog-sitemap"], blogCache);

export async function sitemapPosts(): Promise<{ slugs: Partial<Record<AppLocale, string>>; updatedAt: string }[]> {
  return cachedSitemapPosts().catch(() => []);
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
  kind: PostKind;
  isFeatured: boolean;
  sourceUrl: string | null;
  translations: Partial<Record<AppLocale, AdminTranslation>>;
};

const ADMIN_POST_COLUMNS_V1 =
  "id, status, published_at, category_id, cover_path, created_at, updated_at, post_translations(locale, title, slug, excerpt, content)";
const ADMIN_POST_COLUMNS_V2 = `${ADMIN_POST_COLUMNS_V1}, kind, is_featured, source_url`;

/** Whether posts already has the kind/featured/source columns (checked once; migrations only go forward). */
let hasPostExtras = false;
export async function postsHaveExtras(supabase: ServerSupabaseClient): Promise<boolean> {
  if (hasPostExtras) return true;
  const { error } = await supabase.from("posts").select("kind").limit(1);
  hasPostExtras = !error;
  return hasPostExtras;
}
const adminColumns = async (supabase: ServerSupabaseClient) => ((await postsHaveExtras(supabase)) ? ADMIN_POST_COLUMNS_V2 : ADMIN_POST_COLUMNS_V1);

type AdminPostRow = {
  id: string;
  status: PostStatus;
  published_at: string | null;
  category_id: string | null;
  cover_path: string | null;
  created_at: string;
  updated_at: string;
  kind?: PostKind;
  is_featured?: boolean;
  source_url?: string | null;
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
    kind: r.kind ?? "article",
    isFeatured: r.is_featured ?? false,
    sourceUrl: r.source_url ?? null,
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
  let query = supabase.from("posts").select(await adminColumns(supabase), { count: "exact" });
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
  return { rows: ((data ?? []) as unknown as AdminPostRow[]).map(toAdminPost), total, page: Math.min(params.page, pageCount), pageCount };
}

export async function getAdminPost(supabase: ServerSupabaseClient, id: string): Promise<AdminPost | null> {
  const { data, error } = await supabase.from("posts").select(await adminColumns(supabase)).eq("id", id).maybeSingle();
  if (error) throw new Error(`[blog] admin get failed: ${error.code}`);
  return data ? toAdminPost(data as unknown as AdminPostRow) : null;
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
