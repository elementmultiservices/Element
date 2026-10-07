import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { QuotaMeter } from "@/components/files/quota-meter";
import { UploadForm } from "@/components/files/upload-form";
import { PageHeader } from "@/components/layout/page-header";
import { toLocale } from "@/i18n/routing";
import { requireUser } from "@/lib/auth/session";
import { getStorageUsage, listActiveCategories } from "@/lib/files/queries";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({ params }: PageProps<"/[locale]/dashboard/upload">): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata({ locale: toLocale(locale), path: "/dashboard/upload", page: "upload", noIndex: true });
}

export default async function UploadPage({ params }: PageProps<"/[locale]/dashboard/upload">) {
  const { locale } = await params;
  setRequestLocale(toLocale(locale));
  const session = await requireUser();
  const t = await getTranslations();
  const supabase = await createClient();
  const [usage, categories] = await Promise.all([getStorageUsage(supabase, session.userId), listActiveCategories(supabase)]);

  return (
    <>
      <PageHeader
        title={t("Panel.user.upload")}
        description={t("Upload.description")}
        breadcrumbs={[
          { label: t("Panel.dashboardTitle"), href: "/dashboard" },
          { label: t("Panel.user.files"), href: "/dashboard" },
          { label: t("Panel.user.upload") },
        ]}
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0">
          <UploadForm categories={categories} />
        </div>
        <aside className="order-first xl:order-none">
          <QuotaMeter usage={usage} />
        </aside>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">{t("Auth.recaptchaNotice")}</p>
    </>
  );
}
