import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Article } from "@/components/blog/article";
import { CtaPanel } from "@/components/marketing/cta-panel";
import { SmartLink } from "@/components/marketing/smart-link";
import { Button } from "@/components/ui/button";
import { getSiteContact } from "@/lib/site-settings";
import { Link, redirect } from "@/i18n/navigation";
import { locales, toLocale, type AppLocale } from "@/i18n/routing";
import { coverUrl, getPublishedPost } from "@/lib/blog/queries";
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

  const t = await getTranslations();

  const contact = await getSiteContact();
  const others = locales.filter((l) => l !== locale && post.slugs[l]);

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
      />
      {others.length > 0 ? (
        <aside className="mx-auto max-w-3xl px-4 pb-12 sm:px-6">
          {others.map((l) => (
            <p key={l} className="rounded-2xl border border-azure-50 bg-mist px-5 py-4 text-sm text-graphite">
              <Link href={`/blog/${post.slugs[l]}`} locale={l} className="font-semibold text-electric hover:underline">
                {t("Blog.otherLanguage", { language: t(`Common.languages.${l}`) })}
              </Link>
            </p>
          ))}
        </aside>
      ) : null}
      <CtaPanel id="post-cta" tone="light" title={t("Blog.cta.title")} body={t("Blog.cta.body")}>
        <Button asChild variant="brand" size="pill-lg">
          <SmartLink href={contact.bookingHref}>{t("Nav.book")}</SmartLink>
        </Button>
      </CtaPanel>
    </>
  );
}
