import Image from "next/image";
import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { coverUrl, type PostSummary } from "@/lib/blog/queries";

export async function PostCard({ post }: { post: PostSummary }) {
  const t = await getTranslations("Blog");
  const format = await getFormatter();
  const cover = coverUrl(post.coverPath);

  return (
    <article className="flex flex-col overflow-hidden rounded-lg border bg-card">
      <div className="relative aspect-[16/9] bg-surface">
        {cover ? (
          // Covers are public images from our own storage; served as-is.
          <Image src={cover} alt="" fill unoptimized sizes="(min-width: 1024px) 33vw, 100vw" className="object-cover" />
        ) : (
          <div aria-hidden="true" className="flex h-full items-center justify-center text-3xl font-medium tracking-[0.04em] text-primary/15">
            Element
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          {post.category ? <span className="font-medium text-link uppercase">{post.category.name}</span> : null}
          <time dateTime={post.publishedAt}>{format.dateTime(new Date(post.publishedAt), "short")}</time>
        </div>
        <h2 className="mt-2 text-lg leading-snug">
          <Link href={`/blog/${post.slug}`} className="hover:underline">
            {post.title}
          </Link>
        </h2>
        {post.excerpt ? <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{post.excerpt}</p> : null}
        <Link
          href={`/blog/${post.slug}`}
          className="mt-auto pt-4 text-sm font-medium text-link hover:underline"
          aria-label={t("readMoreAbout", { title: post.title })}
        >
          {t("readMore")}
        </Link>
      </div>
    </article>
  );
}
