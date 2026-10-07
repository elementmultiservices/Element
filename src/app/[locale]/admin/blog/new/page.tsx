import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { toLocale } from "@/i18n/routing";
import { requireAdmin } from "@/lib/auth/session";
import { listPostCategories } from "@/lib/blog/queries";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import { PostEditor } from "../post-editor";

export async function generateMetadata({ params }: PageProps<"/[locale]/admin/blog/new">): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata({ locale: toLocale(locale), path: "/admin/blog/new", page: "adminPostNew", noIndex: true });
}

export default async function NewPostPage({ params }: PageProps<"/[locale]/admin/blog/new">) {
  const { locale: rawLocale } = await params;
  const locale = toLocale(rawLocale);
  setRequestLocale(locale);
  await requireAdmin();
  const t = await getTranslations();
  const categories = await listPostCategories(await createClient());

  return (
    <>
      <PageHeader
        title={t("Admin.blog.newPost")}
        breadcrumbs={[
          { label: t("Panel.adminTitle"), href: "/admin" },
          { label: t("Panel.admin.blog"), href: "/admin/blog" },
          { label: t("Admin.blog.newPost") },
        ]}
      />
      <div className="max-w-5xl">
        <p className="mb-4 text-sm text-muted-foreground">{t("Admin.blog.editor.coverSaveFirst")}</p>
        <PostEditor post={null} categories={categories.map((c) => ({ id: c.id, label: locale === "es" ? c.nameEs : c.nameEn }))} />
      </div>
    </>
  );
}
