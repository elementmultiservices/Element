import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { z } from "zod";
import { UploadForm } from "@/components/files/upload-form";
import { PageHeader } from "@/components/layout/page-header";
import { toLocale } from "@/i18n/routing";
import { userOptions } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/session";
import { listActiveCategories } from "@/lib/files/queries";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({ params }: PageProps<"/[locale]/admin/files/upload">): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata({ locale: toLocale(locale), path: "/admin/files/upload", page: "adminUpload", noIndex: true });
}

export default async function AdminUploadPage({ params, searchParams }: PageProps<"/[locale]/admin/files/upload">) {
  const { locale } = await params;
  setRequestLocale(toLocale(locale));
  await requireAdmin();
  const t = await getTranslations();

  const ownerParam = z.uuid().safeParse((await searchParams).owner);
  const supabase = await createClient();
  const [options, categories] = await Promise.all([userOptions(supabase), listActiveCategories(supabase)]);
  const owners = options
    .filter((o) => o.role === "user" && o.isActive)
    .map((o) => ({ id: o.id, label: o.fullName ? `${o.fullName} · ${o.email}` : o.email }));
  const defaultOwnerId = ownerParam.success && owners.some((o) => o.id === ownerParam.data) ? ownerParam.data : undefined;

  return (
    <>
      <PageHeader
        title={t("Admin.files.upload")}
        description={t("Admin.files.uploadDescription")}
        breadcrumbs={[
          { label: t("Panel.adminTitle"), href: "/admin" },
          { label: t("Panel.admin.files"), href: "/admin/files" },
          { label: t("Admin.files.upload") },
        ]}
      />
      <div className="max-w-4xl">
        {owners.length === 0 ? (
          <p className="rounded-[24px] border border-dashed border-azure-100 bg-surface px-6 py-10 text-center text-sm text-muted-foreground">{t("Admin.files.noOwners")}</p>
        ) : (
          <UploadForm categories={categories} owners={owners} defaultOwnerId={defaultOwnerId} />
        )}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">{t("Auth.recaptchaNotice")}</p>
    </>
  );
}
