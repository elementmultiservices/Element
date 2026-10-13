import { getFormatter, getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { PostCover } from "@/components/blog/post-card";
import { type PostSummary } from "@/lib/blog/queries";
import { stagger } from "@/components/marketing/motion";
import { container, SectionIntro } from "@/components/marketing/section-intro";

export async function LatestNews({ posts }: { posts: PostSummary[] }) {
  const t = await getTranslations("Home.blog");
  const format = await getFormatter();
  const [featured, ...rest] = posts;

  const date = (post: PostSummary) =>
    format.dateTime(new Date(post.publishedAt), { day: "numeric", month: "short", year: "numeric" });

  return (
    <section aria-labelledby="news-title" className={`${container} flex flex-col gap-10 py-16 lg:py-24`}>
      <SectionIntro id="news-title" align="center" eyebrow={t("eyebrow")} title={t("title")} body={t("body")} />
      {!featured ? (
        <p className="text-center text-graphite">{t("empty")}</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
          <article className="reveal group relative flex flex-col overflow-hidden rounded-[28px] border border-azure-50 bg-white transition-shadow duration-300 hover:shadow-[0_24px_48px_rgba(5,13,41,0.08)]">
            <PostCover post={featured} className="aspect-[16/9]" sizes="(min-width: 1024px) 55vw, 100vw" />
            <div className="flex flex-col gap-3 p-6 lg:p-7">
              <PostMeta post={featured} date={date(featured)} />
              <h3 className="text-2xl leading-tight font-semibold text-ink lg:text-[26px]">
                <Link href={`/blog/${featured.slug}`} className="after:absolute after:inset-0 group-hover:text-electric">
                  {featured.title}
                </Link>
              </h3>
              {featured.excerpt ? <p className="line-clamp-2 text-base text-graphite">{featured.excerpt}</p> : null}
            </div>
          </article>
          <div className="flex flex-col gap-4">
            {rest.map((post, i) => (
              <article
                key={post.id}
                style={stagger(i + 1)}
                className="reveal group relative flex items-center gap-4 rounded-[24px] border border-azure-50 bg-white p-4"
              >
                <PostCover post={post} className="size-24 shrink-0 rounded-2xl" sizes="96px" iconClass="size-7" />
                <div className="flex min-w-0 flex-col gap-2">
                  <h3 className="text-lg leading-snug font-semibold text-ink">
                    <Link href={`/blog/${post.slug}`} className="after:absolute after:inset-0 group-hover:text-electric">
                      {post.title}
                    </Link>
                  </h3>
                  <PostMeta post={post} date={date(post)} />
                </div>
              </article>
            ))}
            <Link
              href="/blog"
              className="mt-auto inline-flex min-h-14 items-center justify-center gap-2 rounded-full border border-azure-100 px-7 text-[17px] font-semibold text-ink transition-colors hover:bg-azure-25"
            >
              {t("viewAll")}
              <ArrowRight aria-hidden="true" className="size-[18px]" />
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}

function PostMeta({ post, date }: { post: PostSummary; date: string }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 text-[13px] text-graphite">
      {post.category ? <span className="font-medium text-electric">{post.category.name}</span> : null}
      <time dateTime={post.publishedAt} className="font-mono text-xs">
        {date}
      </time>
    </p>
  );
}
