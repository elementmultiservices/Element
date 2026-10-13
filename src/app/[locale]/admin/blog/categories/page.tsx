import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { toLocale } from "@/i18n/routing";
import { requireAdmin } from "@/lib/auth/session";
import { listPostCategories } from "@/lib/blog/queries";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import { PostCategoryForm, PostCategoryRow } from "./post-category-forms";

export async function generateMetadata({ params }: PageProps<"/[locale]/admin/blog/categories">): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata({ locale: toLocale(locale), path: "/admin/blog/categories", page: "adminPostCategories", noIndex: true });
}

export default async function PostCategoriesPage({ params }: PageProps<"/[locale]/admin/blog/categories">) {
  const { locale: rawLocale } = await params;
  const locale = toLocale(rawLocale);
  setRequestLocale(locale);
  await requireAdmin();
  const t = await getTranslations();
  const categories = await listPostCategories(await createClient());

  return (
    <>
      <PageHeader
        title={t("Panel.admin.blogCategories")}
        description={t("Admin.postCategories.description")}
        breadcrumbs={[
          { label: t("Panel.adminTitle"), href: "/admin" },
          { label: t("Panel.admin.blog"), href: "/admin/blog" },
          { label: t("Panel.admin.blogCategories") },
        ]}
      />
      <section aria-labelledby="new-post-category" className="mb-6 rounded-[24px] border border-azure-50 bg-white p-6">
        <h2 id="new-post-category" className="mb-4 text-lg">
          {t("Admin.postCategories.createHeading")}
        </h2>
        <div className="max-w-3xl">
          <PostCategoryForm />
        </div>
      </section>
      {categories.length === 0 ? (
        <p className="rounded-[24px] border border-dashed border-azure-100 bg-surface px-6 py-10 text-center text-sm text-muted-foreground">{t("Admin.postCategories.empty")}</p>
      ) : (
        <section aria-label={t("Admin.postCategories.table.caption")} className="rounded-[24px] border border-azure-50 bg-white">
          <ul className="divide-y">
            {categories.map((c) => (
              <PostCategoryRow
                key={c.id}
                category={{ id: c.id, nameEn: c.nameEn, nameEs: c.nameEs, slugEn: c.slugEn, slugEs: c.slugEs }}
                displayName={locale === "es" ? c.nameEs : c.nameEn}
                postCount={c.postCount}
              />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
