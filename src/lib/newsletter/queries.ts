import "server-only";
import type { AppLocale } from "@/i18n/routing";
import type { ServerSupabaseClient } from "@/lib/supabase/server";

export const SUBSCRIBERS_PAGE_SIZE = 50;
export const SUBSCRIBER_STATUSES = ["active", "unsubscribed"] as const;
export type SubscriberStatus = (typeof SUBSCRIBER_STATUSES)[number];

export type Subscriber = {
  id: string;
  email: string;
  locale: AppLocale;
  source: string;
  createdAt: string;
  unsubscribedAt: string | null;
};

/** Table missing: the newsletter migration has not been applied yet. */
const NOT_MIGRATED = new Set(["PGRST205", "42P01", "PGRST202"]);
export const newsletterNotMigrated = (code: string | undefined) => !!code && NOT_MIGRATED.has(code);

const like = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export async function listSubscribers(
  supabase: ServerSupabaseClient,
  params: { status?: SubscriberStatus; q?: string; page: number },
  pageSize = SUBSCRIBERS_PAGE_SIZE,
): Promise<{ rows: Subscriber[]; total: number; page: number; pageCount: number; ready: boolean }> {
  let query = supabase
    .from("newsletter_subscribers")
    .select("id, email, locale, source, created_at, unsubscribed_at", { count: "exact" });
  if (params.status === "active") query = query.is("unsubscribed_at", null);
  if (params.status === "unsubscribed") query = query.not("unsubscribed_at", "is", null);
  if (params.q) query = query.ilike("email", like(params.q.toLowerCase()));
  const from = (params.page - 1) * pageSize;
  const { data, count, error } = await query.order("created_at", { ascending: false }).order("id").range(from, from + pageSize - 1);
  if (error) {
    if (newsletterNotMigrated(error.code)) return { rows: [], total: 0, page: 1, pageCount: 1, ready: false };
    if (error.code !== "PGRST103") throw new Error(`[newsletter] list failed: ${error.code}`);
  }
  const total = count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  return {
    rows: (data ?? []).map((r) => ({
      id: r.id,
      email: r.email,
      locale: r.locale,
      source: r.source,
      createdAt: r.created_at,
      unsubscribedAt: r.unsubscribed_at,
    })),
    total,
    page: Math.min(params.page, pageCount),
    pageCount,
    ready: true,
  };
}

export async function countActiveSubscribers(supabase: ServerSupabaseClient): Promise<number | null> {
  const { count, error } = await supabase
    .from("newsletter_subscribers")
    .select("id", { count: "exact", head: true })
    .is("unsubscribed_at", null);
  if (error) return null;
  return count ?? 0;
}

export type NewsletterSend = { id: string; slug: string | null; title: string; recipients: number; failed: number; createdAt: string };

/** Latest newsletter emails sent, newest first (includes sends from before the blog was removed). */
export async function listRecentSends(supabase: ServerSupabaseClient, limit = 200): Promise<NewsletterSend[]> {
  const { data, error } = await supabase
    .from("newsletter_sends")
    .select("id, update_slug, title, recipients, failed, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []).map((s) => ({ id: s.id, slug: s.update_slug, title: s.title, recipients: s.recipients, failed: s.failed, createdAt: s.created_at }));
}
