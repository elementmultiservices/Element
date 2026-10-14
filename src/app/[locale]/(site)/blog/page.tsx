import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { z } from "zod";
import { PostCard, PostCover } from "@/components/blog/post-card";
import { CtaPanel } from "@/components/marketing/cta-panel";
import { NewsletterCard } from "@/components/newsletter/newsletter-card";
import { delay, stagger } from "@/components/marketing/motion";
import { SmartLink } from "@/components/marketing/smart-link";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { listPublicCategories, listPublishedPosts, POST_KINDS, type PostSummary } from "@/lib/blog/queries";
import { SLUG_PATTERN } from "@/lib/blog/slug";
import { getSiteContact } from "@/lib/site-settings";
import { pageMetadata } from "@/lib/seo";
import { cn } from "@/lib/utils";

const paramsSchema = z.object({
  category: z.string().max(100).regex(SLUG_PATTERN).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(1000).default(1).catch(1),
  kind: z.enum(POST_KINDS).optional().catch(undefined),
});

export async function generateMetadata({ params }: PageProps<"/[locale]/blog">): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata({ locale: toLocale(locale), path: "/blog", page: "blog", descriptionKey: "blog" });
}

export default async function BlogPage({ params, searchParams }: PageProps<"/[locale]/blog">) {
  const { locale: rawLocale } = await params;
  const locale = toLocale(rawLocale);
  setRequestLocale(locale);
  const { category, page, kind } = paramsSchema.parse(await searchParams);
  const [t, tn, format, contact, list, categories] = await Promise.all([
    getTranslations("Blog"),
    getTranslations("Nav"),
    getFormatter(),
    getSiteContact(),
    listPublishedPosts(locale, { category, page, kind }),
    listPublicCategories(locale),
  ]);
  const query = (overrides: { category?: string; kind?: string; page?: number }) => {
    const q: Record<string, string> = {};
    const c = "category" in overrides ? overrides.category : category;
    const k = "kind" in overrides ? overrides.kind : kind;
    const p = overrides.page ?? 1;
    if (c) q.category = c;
    if (k) q.kind = k;
    if (p > 1) q.page = String(p);
    return q;
  };
  const date = (post: PostSummary) =>
    [
      format.dateTime(new Date(post.publishedAt), { day: "numeric", month: "short", year: "numeric" }),
      post.readingMinutes ? t("minutes", { count: post.readingMinutes }) : null,
    ]
      .filter(Boolean)
      .join(" · ");

  // The magazine layout (featured + two side stories) only on the unfiltered first page.
  const magazine = !category && !kind && page === 1 && list.posts.length >= 3;
  const featured = (magazine && list.posts.find((p) => p.isFeatured)) || list.posts[0];
  const others = list.posts.filter((p) => p !== featured);
  const side = magazine ? others.slice(0, 2) : [];
  const grid = magazine ? others.slice(2) : list.posts;

  const pill = (active: boolean) =>
    cn("rounded-full px-4 py-2 text-sm font-medium transition-colors duration-300", active ? "bg-ink text-white" : "bg-azure-25 text-ink hover:bg-azure-50");

  return (
    <>
      <section className="mx-auto flex max-w-[1240px] flex-col items-center gap-5 px-4 pt-12 pb-12 text-center sm:px-6 lg:pt-16">
        <p style={delay(0)} className="motion-enter font-mono text-xs tracking-[0.2em] text-electric">
          {t("eyebrow")}
        </p>
        <h1 style={delay(1)} className="motion-enter text-[44px] leading-[1] font-semibold tracking-[-0.03em] text-ink sm:text-6xl lg:text-[76px]">
          {t("heroTitleStart")}
          <br />
          <span className="text-electric">{t("heroTitleAccent")}</span>
        </h1>
        <p style={delay(2)} className="motion-enter max-w-[560px] text-base leading-relaxed text-graphite sm:text-lg">
          {t("heroBody")}
        </p>
        {categories.length > 0 || kind ? (
          <nav style={delay(3)} aria-label={t("categoriesLabel")} className="motion-enter mt-2">
            <ul className="flex flex-wrap justify-center gap-2">
              <li>
                <Link
                  href={{ pathname: "/blog", query: query({ category: undefined, kind: undefined }) }}
                  aria-current={!category && !kind ? "page" : undefined}
                  className={pill(!category && !kind)}
                >
                  {t("allCategories")}
                </Link>
              </li>
              <li>
                <Link
                  href={{ pathname: "/blog", query: query({ category: undefined, kind: "update" }) }}
                  aria-current={kind === "update" ? "page" : undefined}
                  className={pill(kind === "update")}
                >
                  {t("updatesFilter")}
                </Link>
              </li>
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={{ pathname: "/blog", query: query({ category: c.slug, kind: undefined }) }}
                    aria-current={category === c.slug ? "page" : undefined}
                    className={pill(category === c.slug)}
                  >
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </section>

      {list.posts.length === 0 ? (
        <p className="mx-auto mb-24 max-w-[560px] rounded-[24px] border border-dashed border-azure-100 bg-mist px-6 py-14 text-center text-graphite">
          {category || kind ? t("emptyCategory") : t("empty")}
        </p>
      ) : null}

      {magazine && featured ? (
        <section aria-label={t("featured")} className="mx-auto grid max-w-[1240px] gap-4 px-4 sm:px-6 lg:grid-cols-[1.15fr_1fr]">
          <article style={delay(4)} className="motion-enter-scale group relative flex min-h-[420px] flex-col justify-end overflow-hidden rounded-[32px] bg-azure-50 p-4 lg:min-h-[480px]">
            <PostCover post={featured} className="absolute inset-0" sizes="(min-width: 1024px) 55vw, 100vw" iconClass="size-24 -translate-y-16" preload />
            <div className="relative flex flex-col gap-3 rounded-[24px] bg-white p-6 shadow-[0_20px_40px_rgba(5,13,41,0.12)]">
              <p className="font-mono text-[11px] tracking-[0.14em] text-electric">
                {featured.kind === "update" ? t("kinds.update").toUpperCase() : t("featured")}
              </p>
              <h2 className="text-2xl leading-tight font-semibold tracking-[-0.01em] text-ink sm:text-[28px]">
                <Link href={`/blog/${featured.slug}`} className="after:absolute after:inset-0 group-hover:text-electric">
                  {featured.title}
                </Link>
              </h2>
              {featured.excerpt ? <p className="line-clamp-2 text-[15px] text-graphite">{featured.excerpt}</p> : null}
              <p className="flex flex-wrap items-center gap-3 text-sm text-graphite">
                {featured.category ? <span className="rounded-full bg-azure-25 px-3 py-1 text-xs font-medium text-electric">{featured.category.name}</span> : null}
                <time dateTime={featured.publishedAt}>{date(featured)}</time>
              </p>
            </div>
          </article>
          <div className="flex flex-col gap-4">
            {side.map((post, i) => (
              <article key={post.id} style={delay(5 + i)} className="motion-enter group relative flex items-center gap-5 rounded-[24px] p-2 transition-colors hover:bg-mist">
                <PostCover post={post} className="aspect-[4/3] w-32 shrink-0 rounded-[20px] sm:w-40" sizes="160px" iconClass="size-9" />
                <div className="flex min-w-0 flex-col gap-2">
                  <h2 className="text-lg leading-snug font-semibold text-ink sm:text-xl">
                    <Link href={`/blog/${post.slug}`} className="after:absolute after:inset-0 group-hover:text-electric">
                      {post.title}
                    </Link>
                  </h2>
                  <p className="flex flex-wrap items-center gap-2.5 text-xs text-graphite">
                    {post.category ? <span className="rounded-full bg-azure-25 px-2.5 py-1 font-medium text-electric">{post.category.name}</span> : null}
                    <time dateTime={post.publishedAt}>{date(post)}</time>
                  </p>
                </div>
              </article>
            ))}
            <NewsletterCard source="blog" className="motion-enter mt-auto" />
          </div>
        </section>
      ) : null}

      {grid.length > 0 ? (
        <section aria-labelledby="latest-title" className="mx-auto flex max-w-[1240px] flex-col gap-8 px-4 pt-16 sm:px-6 lg:pt-24">
          <div className="reveal flex flex-wrap items-end justify-between gap-3">
            <h2 id="latest-title" className="text-[32px] leading-[1.05] font-semibold tracking-[-0.02em] text-ink sm:text-[44px]">
              {t("latest")}
            </h2>
            <p className="text-sm text-graphite">{t("latestNote")}</p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {grid.map((post, i) => (
              <li key={post.id} style={stagger(i % 3)} className="reveal">
                <PostCard post={post} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!magazine ? (
        <div className="mx-auto max-w-[1240px] px-4 pt-12 sm:px-6">
          <NewsletterCard source="blog" className="reveal mx-auto max-w-[640px]" />
        </div>
      ) : null}

      {list.pageCount > 1 ? (
        <nav aria-label={t("pagination.label")} className="mx-auto mt-12 flex max-w-[1240px] flex-wrap items-center justify-center gap-3 px-4 text-sm sm:px-6">
          {list.page > 1 ? (
            <Link
              href={{ pathname: "/blog", query: query({ page: list.page - 1 }) }}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-azure-100 px-5 font-semibold text-ink hover:bg-azure-25"
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              {t("pagination.previous")}
            </Link>
          ) : null}
          <span className="px-2 font-mono text-xs text-graphite">{t("pagination.page", { page: list.page, pages: list.pageCount })}</span>
          {list.page < list.pageCount ? (
            <Link
              href={{ pathname: "/blog", query: query({ page: list.page + 1 }) }}
              className="group inline-flex min-h-11 items-center gap-2 rounded-full border border-azure-100 px-5 font-semibold text-ink hover:bg-azure-25"
            >
              {t("viewMore")}
              <ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
          ) : null}
        </nav>
      ) : null}

      <CtaPanel id="blog-cta" tone="light" title={t("cta.title")} body={t("cta.body")} className="pt-16 lg:pt-24">
        <Button asChild variant="brand" size="pill-lg">
          <SmartLink href={contact.bookingHref}>{tn("book")}</SmartLink>
        </Button>
      </CtaPanel>
    </>
  );
}
