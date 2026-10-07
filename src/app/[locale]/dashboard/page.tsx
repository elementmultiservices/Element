import type { Metadata } from "next";
import { FileText, SearchX, Upload } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { FileFilters } from "@/components/files/file-filters";
import { FilesTable } from "@/components/files/files-table";
import { QuotaMeter } from "@/components/files/quota-meter";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { requireUser } from "@/lib/auth/session";
import { getStorageUsage, listActiveCategories, listFiles } from "@/lib/files/queries";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import { fileListParamsSchema } from "@/lib/validation/files";

export async function generateMetadata({ params }: PageProps<"/[locale]/dashboard">): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata({ locale: toLocale(locale), path: "/dashboard", page: "dashboard", noIndex: true });
}

export default async function DashboardPage({ params, searchParams }: PageProps<"/[locale]/dashboard">) {
  const { locale } = await params;
  setRequestLocale(toLocale(locale));
  const session = await requireUser();
  const t = await getTranslations();

  const filters = fileListParamsSchema.parse(await searchParams);
  const supabase = await createClient();
  const [list, usage, categories] = await Promise.all([
    listFiles(supabase, filters, { ownerId: session.userId }),
    getStorageUsage(supabase, session.userId),
    listActiveCategories(supabase),
  ]);
  const hasFilters = Boolean(filters.q || filters.type || filters.category || filters.from || filters.to);

  return (
    <>
      <PageHeader
        title={t("Panel.user.files")}
        description={t("Files.description")}
        breadcrumbs={[{ label: t("Panel.dashboardTitle"), href: "/dashboard" }, { label: t("Panel.user.files") }]}
        actions={
          <Button asChild>
            <Link href="/dashboard/upload">
              <Upload aria-hidden="true" />
              {t("Files.uploadCta")}
            </Link>
          </Button>
        }
      />
      <div className="min-w-0 space-y-4">
        <QuotaMeter usage={usage} className="max-w-xl" />
        <div className="min-w-0 space-y-4">
          <FileFilters params={filters} categories={categories} basePath="/dashboard" />
          {list.total === 0 ? (
            hasFilters ? (
              <EmptyState icon={SearchX} title={t("Files.noResults.title")} body={t("Files.noResults.body")} />
            ) : (
              <EmptyState
                icon={FileText}
                title={t("Files.empty.title")}
                body={t("Files.empty.body")}
                action={
                  <Button asChild size="sm">
                    <Link href="/dashboard/upload">{t("Files.uploadCta")}</Link>
                  </Button>
                }
              />
            )
          ) : (
            <FilesTable rows={list.rows} total={list.total} pageCount={list.pageCount} params={filters} basePath="/dashboard" />
          )}
        </div>
      </div>
    </>
  );
}
