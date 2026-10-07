import Image from "next/image";
import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { coverUrl } from "@/lib/blog/queries";
import { sanitizePostHtml } from "@/lib/blog/sanitize";

export type ArticleData = {
  title: string;
  excerpt: string;
  content: string;
  coverPath: string | null;
  publishedAt: string | null;
  category: { name: string; slug: string } | null;
};

/**
 * Renders a post. The stored HTML was sanitized when saved and is sanitized
 * again here before being inserted, so the database is never trusted blindly.
 */
export async function Article({
  post,
  backLink = true,
  locale,
}: {
  post: ArticleData;
  backLink?: boolean;
  /** Language of the post when it differs from the page (admin preview). */
  locale?: AppLocale;
}) {
  const t = locale ? await getTranslations({ locale, namespace: "Blog" }) : await getTranslations("Blog");
  const format = locale ? await getFormatter({ locale }) : await getFormatter();
  const cover = coverUrl(post.coverPath);
  const html = sanitizePostHtml(post.content);

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      {backLink ? (
        <Link href="/blog" className="text-sm text-link hover:underline">
          ← {t("backToBlog")}
        </Link>
      ) : null}
      <header className="mt-6">
        <div className="flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
          {post.category ? (
            <Link href={{ pathname: "/blog", query: { category: post.category.slug } }} className="font-medium text-link uppercase hover:underline">
              {post.category.name}
            </Link>
          ) : null}
          {post.publishedAt ? (
            <time dateTime={post.publishedAt}>{t("publishedOn", { date: format.dateTime(new Date(post.publishedAt), { dateStyle: "long" }) })}</time>
          ) : null}
        </div>
        <h1 className="mt-3 text-3xl sm:text-4xl">{post.title}</h1>
        {post.excerpt ? <p className="mt-4 text-lg text-muted-foreground">{post.excerpt}</p> : null}
      </header>
      {cover ? (
        <div className="relative mt-8 aspect-[16/9] overflow-hidden rounded-lg border bg-surface">
          <Image src={cover} alt="" fill unoptimized priority sizes="(min-width: 768px) 768px, 100vw" className="object-cover" />
        </div>
      ) : null}
      {/* Sanitized allowlist HTML (sanitizePostHtml). */}
      <div className="prose-element mt-10" dangerouslySetInnerHTML={{ __html: html }} />
    </article>
  );
}
