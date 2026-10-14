import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { toLocale } from "@/i18n/routing";
import { requireAdmin } from "@/lib/auth/session";
import { coverUrl, getAdminPost, listPostCategories } from "@/lib/blog/queries";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import { NewsletterPanel } from "../newsletter-panel";
import { DeletePostButton } from "../post-actions";
import { PostEditor } from "../post-editor";

export async function generateMetadata({ params }: PageProps<"/[locale]/admin/blog/[id]">): Promise<Metadata> {
  const { locale, id } = await params;
  return pageMetadata({ locale: toLocale(locale), path: `/admin/blog/${id}`, page: "adminPostEdit", noIndex: true });
}

export default async function EditPostPage({ params }: PageProps<"/[locale]/admin/blog/[id]">) {
  const { locale: rawLocale, id } = await params;
  const locale = toLocale(rawLocale);
  setRequestLocale(locale);
  await requireAdmin();
  if (!z.uuid().safeParse(id).success) notFound();

  const t = await getTranslations();
  const supabase = await createClient();
  const [post, categories] = await Promise.all([getAdminPost(supabase, id), listPostCategories(supabase)]);
  if (!post) notFound();
  const title = post.translations[locale]?.title ?? post.translations.en?.title ?? post.translations.es?.title ?? t("Admin.blog.untitled");

  return (
    <>
      <PageHeader
        title={title}
        description={t("Metadata.pages.adminPostEdit")}
        breadcrumbs={[
          { label: t("Panel.adminTitle"), href: "/admin" },
          { label: t("Panel.admin.blog"), href: "/admin/blog" },
          { label: title },
        ]}
        actions={<DeletePostButton id={post.id} onDeletedHref="/admin/blog" />}
      />
      <div className="space-y-6">
        <NewsletterPanel post={post} supabase={supabase} />
        <PostEditor
          post={{
            id: post.id,
            status: post.status,
            publishedAt: post.publishedAt,
            categoryId: post.categoryId,
            coverUrl: coverUrl(post.coverPath),
            kind: post.kind,
            isFeatured: post.isFeatured,
            sourceUrl: post.sourceUrl,
            translations: post.translations,
          }}
          categories={categories.map((c) => ({ id: c.id, label: locale === "es" ? c.nameEs : c.nameEn }))}
        />
      </div>
    </>
  );
}
