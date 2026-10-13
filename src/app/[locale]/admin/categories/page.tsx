import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { TableShell, Th } from "@/components/tables/table-kit";
import { Badge } from "@/components/ui/badge";
import { toLocale } from "@/i18n/routing";
import { listCategories } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/session";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { CategoryRowActions, CreateCategoryForm } from "./category-forms";

export async function generateMetadata({ params }: PageProps<"/[locale]/admin/categories">): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata({ locale: toLocale(locale), path: "/admin/categories", page: "adminCategories", noIndex: true });
}

export default async function AdminCategoriesPage({ params }: PageProps<"/[locale]/admin/categories">) {
  const { locale: rawLocale } = await params;
  const locale = toLocale(rawLocale);
  setRequestLocale(locale);
  await requireAdmin();
  const t = await getTranslations();
  const format = await getFormatter();
  const supabase = await createClient();
  const categories = await listCategories(supabase);

  return (
    <>
      <PageHeader
        title={t("Panel.admin.categories")}
        description={t("Admin.categories.description")}
        breadcrumbs={[{ label: t("Panel.adminTitle"), href: "/admin" }, { label: t("Panel.admin.categories") }]}
      />

      <section aria-labelledby="new-category" className="mb-6 rounded-[24px] border border-azure-50 bg-white p-6">
        <h2 id="new-category" className="mb-4 text-lg">
          {t("Admin.categories.createHeading")}
        </h2>
        <div className="max-w-3xl">
          <CreateCategoryForm />
        </div>
      </section>

      {categories.length === 0 ? (
        <p className="rounded-[24px] border border-dashed border-azure-100 bg-surface px-6 py-10 text-center text-sm text-muted-foreground">{t("Admin.categories.empty")}</p>
      ) : (
        <TableShell caption={t("Admin.categories.table.caption")}>
          <thead className="border-b bg-surface">
            <tr>
              <Th>{t("Admin.categories.table.nameEn")}</Th>
              <Th>{t("Admin.categories.table.nameEs")}</Th>
              <Th className="text-right">{t("Admin.categories.table.files")}</Th>
              <Th>{t("Admin.categories.table.status")}</Th>
              <Th className="text-right">
                <span className="sr-only">{t("Admin.common.actions")}</span>
              </Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-azure-50">
            {categories.map((c) => (
              <tr key={c.id} className={cn("align-top hover:bg-surface/60", c.isArchived && "text-muted-foreground")}>
                <td className="px-4 py-3.5 font-medium" lang="en">
                  {c.nameEn}
                </td>
                <td className="px-4 py-3.5 font-medium" lang="es">
                  {c.nameEs}
                </td>
                <td className="px-4 py-3.5 text-right tabular-nums">{format.number(c.fileCount)}</td>
                <td className="px-4 py-3.5">
                  <Badge
                    variant="outline"
                    className={cn("font-normal", c.isArchived ? "text-muted-foreground" : "border-success/30 bg-success-bg text-success")}
                  >
                    {c.isArchived ? t("Admin.categories.statusArchived") : t("Admin.categories.statusActive")}
                  </Badge>
                </td>
                <td className="px-4 py-3.5">
                  <CategoryRowActions
                    id={c.id}
                    nameEn={c.nameEn}
                    nameEs={c.nameEs}
                    isArchived={c.isArchived}
                    displayName={locale === "es" ? c.nameEs : c.nameEn}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}
    </>
  );
}
