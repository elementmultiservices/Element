import type { ReactNode } from "react";
import Image from "next/image";
import { getFormatter, getTranslations } from "next-intl/server";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { delay } from "@/components/marketing/motion";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { coverUrl, optimizeCovers } from "@/lib/blog/queries";
import { sanitizePostHtml } from "@/lib/blog/sanitize";
import { cn } from "@/lib/utils";

export function sourceHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export type ArticleData = {
  title: string;
  excerpt: string;
  content: string;
  coverPath: string | null;
  publishedAt: string | null;
  category: { name: string; slug: string } | null;
  kind?: "article" | "update";
  sourceUrl?: string | null;
  readingMinutes?: number | null;
};

/**
 * Renders a post: wide header and cover, then the text at a comfortable
 * reading width with an optional sticky sidebar next to it on large screens.
 * The stored HTML was sanitized when saved and is sanitized again here before
 * being inserted, so the database is never trusted blindly.
 */
export async function Article({
  post,
  backLink = true,
  locale,
  sidebar,
}: {
  post: ArticleData;
  backLink?: boolean;
  /** Language of the post when it differs from the page (admin preview). */
  locale?: AppLocale;
  sidebar?: ReactNode;
}) {
  const t = locale ? await getTranslations({ locale, namespace: "Blog" }) : await getTranslations("Blog");
  const format = locale ? await getFormatter({ locale }) : await getFormatter();
  const cover = coverUrl(post.coverPath);
  const html = sanitizePostHtml(post.content);

  return (
    <article className="mx-auto w-full max-w-[1240px] px-4 pt-10 pb-16 sm:px-6 lg:pt-14 lg:pb-24">
      {backLink ? (
        <Link
          href="/blog"
          className="group inline-flex items-center gap-2 rounded-full border border-azure-100 px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-azure-25"
        >
          <ArrowLeft aria-hidden="true" className="size-4 transition-transform group-hover:-translate-x-0.5" />
          {t("backToBlog")}
        </Link>
      ) : null}

      <header style={delay(1)} className="motion-enter mt-8 max-w-[980px]">
        <div className="flex flex-wrap items-center gap-3 text-sm text-graphite">
          {post.category ? (
            <Link
              href={{ pathname: "/blog", query: { category: post.category.slug } }}
              className="rounded-full bg-azure-25 px-3 py-1 text-xs font-semibold text-electric transition-colors hover:bg-azure-50"
            >
              {post.category.name}
            </Link>
          ) : null}
          {post.kind === "update" ? (
            <span className="rounded-full bg-electric px-3 py-1 text-xs font-semibold text-white">{t("kinds.update")}</span>
          ) : null}
          {post.publishedAt ? (
            <time dateTime={post.publishedAt}>{t("publishedOn", { date: format.dateTime(new Date(post.publishedAt), { dateStyle: "long" }) })}</time>
          ) : null}
          {post.readingMinutes ? <span className="font-mono text-xs">· {t("minutes", { count: post.readingMinutes })}</span> : null}
        </div>
        <h1 className="mt-5 text-[36px] leading-[1.04] font-semibold tracking-[-0.025em] text-ink sm:text-5xl lg:text-[60px]">{post.title}</h1>
        {post.excerpt ? <p className="mt-6 max-w-[760px] text-lg leading-relaxed text-graphite sm:text-xl">{post.excerpt}</p> : null}
      </header>

      {cover ? (
        <div
          style={delay(2)}
          className="motion-enter-scale relative mt-10 aspect-[16/9] overflow-hidden rounded-[28px] bg-azure-25 lg:mt-12 lg:aspect-[21/9] lg:rounded-[36px]"
        >
          <Image src={cover} alt="" fill unoptimized={!optimizeCovers} preload sizes="(min-width: 1280px) 1240px, 100vw" className="object-cover" />
        </div>
      ) : (
        <div aria-hidden="true" className="mt-10 h-px bg-azure-50 lg:mt-12" />
      )}

      <div
        className={cn(
          "mt-10 lg:mt-14",
          sidebar ? "grid gap-12 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-16" : "mx-auto max-w-[760px]",
        )}
      >
        <div className="min-w-0 max-w-[760px]">
          {/* Sanitized allowlist HTML (sanitizePostHtml). */}
          <div style={delay(3)} className="motion-enter prose-element lg:text-[1.1875rem]" dangerouslySetInnerHTML={{ __html: html }} />
          {post.sourceUrl && !sidebar ? (
            <p className="mt-10 flex flex-wrap items-center gap-2 rounded-2xl border border-azure-50 bg-mist px-5 py-4 text-sm text-graphite">
              <span className="font-semibold text-ink">{t("source")}:</span>
              <a href={post.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-electric hover:underline">
                {sourceHost(post.sourceUrl)}
                <ArrowUpRight aria-hidden="true" className="size-4" />
              </a>
            </p>
          ) : null}
        </div>
        {sidebar ? (
          <aside style={delay(4)} className="motion-enter flex flex-col gap-4 lg:sticky lg:top-32 lg:self-start">
            {sidebar}
          </aside>
        ) : null}
      </div>
    </article>
  );
}
