import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { z } from "zod";
import { PostCard } from "@/components/blog/post-card";
import { Link } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { listPublicCategories, listPublishedPosts } from "@/lib/blog/queries";
import { SLUG_PATTERN } from "@/lib/blog/slug";
import { pageMetadata } from "@/lib/seo";
import { cn } from "@/lib/utils";

const paramsSchema = z.object({
  category: z.string().max(100).regex(SLUG_PATTERN).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(1000).default(1).catch(1),
});

export async function generateMetadata({ params }: PageProps<"/[locale]/blog">): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata({ locale: toLocale(locale), path: "/blog", page: "blog", descriptionKey: "blog" });
}

export default async function BlogPage({ params, searchParams }: PageProps<"/[locale]/blog">) {
  const { locale: rawLocale } = await params;
  const locale = toLocale(rawLocale);
  setRequestLocale(locale);
  const t = await getTranslations("Blog");
  const { category, page } = paramsSchema.parse(await searchParams);

  const [list, categories] = await Promise.all([listPublishedPosts(locale, { category, page }), listPublicCategories(locale)]);
  const query = (overrides: { category?: string; page?: number }) => {
    const q: Record<string, string> = {};
    const c = "category" in overrides ? overrides.category : category;
    const p = overrides.page ?? 1;
    if (c) q.category = c;
    if (p > 1) q.page = String(p);
    return q;
  };
  const pillClass = (active: boolean) =>
    cn(
      "rounded-full border px-3 py-1 text-sm",
      active ? "border-primary bg-primary text-primary-foreground" : "bg-card text-foreground hover:bg-accent",
    );

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <header className="max-w-3xl">
        <h1 className="text-3xl sm:text-4xl">{t("title")}</h1>
        <p className="mt-3 text-lg text-muted-foreground">{t("description")}</p>
      </header>

      {categories.length > 0 ? (
        <nav aria-label={t("categoriesLabel")} className="mt-8">
          <ul className="flex flex-wrap gap-2">
            <li>
              <Link href={{ pathname: "/blog", query: query({ category: undefined }) }} aria-current={!category ? "page" : undefined} className={pillClass(!category)}>
                {t("allCategories")}
              </Link>
            </li>
            {categories.map((c) => (
              <li key={c.slug}>
                <Link
                  href={{ pathname: "/blog", query: query({ category: c.slug }) }}
                  aria-current={category === c.slug ? "page" : undefined}
                  className={pillClass(category === c.slug)}
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      {list.posts.length === 0 ? (
        <p className="mt-10 rounded-lg border border-dashed bg-surface px-6 py-12 text-center text-muted-foreground">
          {category ? t("emptyCategory") : t("empty")}
        </p>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {list.posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}

      {list.pageCount > 1 ? (
        <nav aria-label={t("pagination.label")} className="mt-10 flex items-center justify-between gap-4 border-t pt-6 text-sm">
          {list.page > 1 ? (
            <Link href={{ pathname: "/blog", query: query({ page: list.page - 1 }) }} className="text-link hover:underline">
              ← {t("pagination.previous")}
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted-foreground">{t("pagination.page", { page: list.page, pages: list.pageCount })}</span>
          {list.page < list.pageCount ? (
            <Link href={{ pathname: "/blog", query: query({ page: list.page + 1 }) }} className="text-link hover:underline">
              {t("pagination.next")} →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
