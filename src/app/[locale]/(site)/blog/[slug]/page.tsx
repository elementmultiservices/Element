import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight, ArrowUpRight, Languages, MessageCircle } from "lucide-react";
import { Article, sourceHost } from "@/components/blog/article";
import { PostCard, PostCover } from "@/components/blog/post-card";
import { stagger } from "@/components/marketing/motion";
import { SmartLink } from "@/components/marketing/smart-link";
import { Button } from "@/components/ui/button";
import { getSiteContact } from "@/lib/site-settings";
import { Link, redirect } from "@/i18n/navigation";
import { locales, toLocale, type AppLocale } from "@/i18n/routing";
import { coverUrl, getPublishedPost, listPublishedPosts } from "@/lib/blog/queries";
import { SLUG_PATTERN } from "@/lib/blog/slug";
import { pageMetadata } from "@/lib/seo";

const loadPost = cache(async (locale: AppLocale, slug: string) => {
  if (slug.length > 200 || !SLUG_PATTERN.test(slug)) return null;
  return getPublishedPost(locale, slug);
});

export async function generateMetadata({ params }: PageProps<"/[locale]/blog/[slug]">): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  const locale = toLocale(rawLocale);
  const post = await loadPost(locale, slug);
  if (!post?.title || !post.slug) return {};
  const paths = Object.fromEntries(Object.entries(post.slugs).map(([l, s]) => [l, `/blog/${s}`])) as Partial<Record<AppLocale, string>>;
  return pageMetadata({
    locale,
    path: `/blog/${post.slug}`,
    page: "blog",
    title: post.title,
    description: post.excerpt,
    paths,
    image: coverUrl(post.coverPath),
    type: "article",
    publishedTime: post.publishedAt,
  });
}

export default async function BlogPostPage({ params }: PageProps<"/[locale]/blog/[slug]">) {
  const { locale: rawLocale, slug } = await params;
  const locale = toLocale(rawLocale);
  setRequestLocale(locale);

  const post = await loadPost(locale, slug);
  if (!post) notFound();

  // Reached with another language's slug (e.g. after switching language):
  // go to this language's address, or to the blog if there is no translation.
  if (!post.title || !post.slug) return redirect({ href: "/blog", locale });
  if (post.slug !== slug) return redirect({ href: `/blog/${post.slug}`, locale });

  const [t, format, contact, latest] = await Promise.all([
    getTranslations(),
    getFormatter(),
    getSiteContact(),
    listPublishedPosts(locale, { limit: 7 }),
  ]);
  const others = locales.filter((l) => l !== locale && post.slugs[l]);
  const recent = latest.posts.filter((p) => p.id !== post.id);
  const sideRecent = recent.slice(0, 3);
  const moreRecent = recent.slice(3, 6).length === 3 ? recent.slice(3, 6) : recent.slice(0, 3);

  const facts = [
    { label: t("Blog.published"), value: format.dateTime(new Date(post.publishedAt), { dateStyle: "long" }) },
    post.readingMinutes ? { label: t("Blog.readingTime"), value: t("Blog.minutes", { count: post.readingMinutes }) } : null,
    post.category ? { label: t("Blog.category"), value: post.category.name } : null,
  ].filter((f): f is { label: string; value: string } => f !== null);

  const sidebar = (
    <>
      <section aria-labelledby="post-facts" className="rounded-[24px] border border-azure-50 bg-white p-6">
        <h2 id="post-facts" className="font-mono text-xs font-normal tracking-[0.1em] text-graphite uppercase">
          {t("Blog.aboutPost")}
        </h2>
        <dl className="mt-4 divide-y divide-azure-50">
          {facts.map((f) => (
            <div key={f.label} className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
              <dt className="text-graphite">{f.label}</dt>
              <dd className="text-right font-medium text-ink">{f.value}</dd>
            </div>
          ))}
        </dl>
        {post.sourceUrl ? (
          <a
            href={post.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-azure-25 px-3.5 py-2.5 text-sm font-semibold text-electric hover:bg-azure-50"
          >
            <span>
              {t("Blog.source")}: {sourceHost(post.sourceUrl)}
            </span>
            <ArrowUpRight aria-hidden="true" className="size-4 shrink-0" />
          </a>
        ) : null}
        {others.map((l) => (
          <Link
            key={l}
            href={`/blog/${post.slugs[l]}`}
            locale={l}
            className="mt-2 flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-ink hover:bg-azure-25"
          >
            <Languages aria-hidden="true" className="size-4 text-cobalt" />
            {t("Blog.otherLanguage", { language: t(`Common.languages.${l}`) })}
          </Link>
        ))}
      </section>

      <section
        aria-labelledby="post-help"
        className="relative overflow-hidden rounded-[24px] bg-[linear-gradient(160deg,#050D29_0%,#13295A_60%,#2B56B3_100%)] p-6 text-white"
      >
        <span aria-hidden="true" className="motion-float absolute -right-12 -bottom-16 size-44 rounded-full bg-sky/25 blur-3xl" />
        <h2 id="post-help" className="relative text-xl leading-tight font-semibold text-white">
          {t("Blog.sidebarCta.title")}
        </h2>
        <p className="relative mt-2 text-sm leading-relaxed text-azure-100">{t("Blog.sidebarCta.body")}</p>
        <div className="relative mt-5 flex flex-col gap-2">
          <Button asChild variant="brand">
            <SmartLink href={contact.bookingHref}>{t("Nav.book")}</SmartLink>
          </Button>
          <Button asChild className="bg-white text-ink hover:bg-azure-25">
            <SmartLink href={contact.whatsappHref}>
              <MessageCircle aria-hidden="true" />
              {t("Nav.whatsapp")}
            </SmartLink>
          </Button>
        </div>
      </section>

      {sideRecent.length > 0 ? (
        <section aria-labelledby="post-recent" className="hidden rounded-[24px] border border-azure-50 bg-white p-6 lg:block">
          <h2 id="post-recent" className="font-mono text-xs font-normal tracking-[0.1em] text-graphite uppercase">
            {t("Blog.latestShort")}
          </h2>
          <ul className="mt-4 flex flex-col gap-3">
            {sideRecent.map((p) => (
              <li key={p.id} className="group relative flex items-center gap-3">
                <PostCover post={p} className="size-14 shrink-0 rounded-xl" sizes="56px" iconClass="size-5" />
                <Link href={`/blog/${p.slug}`} className="line-clamp-2 text-sm leading-snug font-semibold text-ink after:absolute after:inset-0 group-hover:text-electric">
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );

  return (
    <>
      <Article
        post={{
          title: post.title,
          excerpt: post.excerpt,
          content: post.content,
          coverPath: post.coverPath,
          publishedAt: post.publishedAt,
          category: post.category,
          kind: post.kind,
          sourceUrl: post.sourceUrl,
          readingMinutes: post.readingMinutes,
        }}
        sidebar={sidebar}
      />
      {moreRecent.length > 0 ? (
        <section aria-labelledby="keep-reading" className="border-t border-azure-50 bg-mist py-16 lg:py-20">
          <div className="mx-auto flex max-w-[1240px] flex-col gap-8 px-4 sm:px-6">
            <div className="reveal flex flex-wrap items-end justify-between gap-4">
              <h2 id="keep-reading" className="text-[32px] leading-[1.05] font-semibold tracking-[-0.02em] text-ink sm:text-[44px]">
                {t("Blog.keepReading")}
              </h2>
              <Link href="/blog" className="group inline-flex items-center gap-2 text-sm font-semibold text-electric">
                {t("Blog.viewMore")}
                <ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {moreRecent.map((p, i) => (
                <li key={p.id} style={stagger(i)} className="reveal">
                  <PostCard post={p} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
    </>
  );
}
