import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Eye } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { z } from "zod";
import { Article } from "@/components/blog/article";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { isAppLocale, toLocale } from "@/i18n/routing";
import { requireAdmin } from "@/lib/auth/session";
import { effectiveStatus, getAdminPost, listPostCategories } from "@/lib/blog/queries";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({ params }: PageProps<"/[locale]/admin/blog/[id]/preview">): Promise<Metadata> {
  const { locale, id } = await params;
  return pageMetadata({ locale: toLocale(locale), path: `/admin/blog/${id}/preview`, page: "adminPostPreview", noIndex: true });
}

/** Admin-only preview of any post (drafts included) in the requested language. */
export default async function PostPreviewPage({ params, searchParams }: PageProps<"/[locale]/admin/blog/[id]/preview">) {
  const { locale: rawLocale, id } = await params;
  const locale = toLocale(rawLocale);
  setRequestLocale(locale);
  await requireAdmin();
  if (!z.uuid().safeParse(id).success) notFound();

  const requested = (await searchParams).lang;
  const lang = isAppLocale(requested) ? requested : locale;
  const t = await getTranslations();
  const supabase = await createClient();
  const [post, categories] = await Promise.all([getAdminPost(supabase, id), listPostCategories(supabase)]);
  if (!post) notFound();

  const translation = post.translations[lang];
  const category = categories.find((c) => c.id === post.categoryId);
  // The article is rendered with the post's language messages (dates, labels).
  const tl = await getTranslations({ locale: lang, namespace: "Common" });

  return (
    <div className="-mx-4 -my-6 bg-background sm:-mx-6 lg:-my-8">
      <div role="status" className="flex flex-wrap items-center justify-between gap-3 border-b bg-info-bg px-4 py-3 text-sm text-info sm:px-6">
        <p className="flex items-center gap-2">
          <Eye aria-hidden="true" className="size-4" />
          {t("Admin.blog.previewBanner", {
            language: tl(`languages.${lang}`),
            status: t(`Admin.blog.statuses.${effectiveStatus(post)}`),
          })}
        </p>
        <Button asChild size="sm" variant="outline">
          <Link href={`/admin/blog/${post.id}`}>{t("Admin.blog.backToEditor")}</Link>
        </Button>
      </div>
      {translation ? (
        <div lang={lang}>
          <Article
            backLink={false}
            locale={lang}
            post={{
              title: translation.title,
              excerpt: translation.excerpt,
              content: translation.content,
              coverPath: post.coverPath,
              publishedAt: post.publishedAt ?? post.updatedAt,
              category: category ? { name: lang === "es" ? category.nameEs : category.nameEn, slug: lang === "es" ? category.slugEs : category.slugEn } : null,
            }}
          />
        </div>
      ) : (
        <p className="px-6 py-16 text-center text-muted-foreground">{t("Admin.blog.previewMissing")}</p>
      )}
    </div>
  );
}
