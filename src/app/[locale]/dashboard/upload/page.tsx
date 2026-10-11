import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { UploadForm } from "@/components/files/upload-form";
import { FormAlert } from "@/components/forms/form-alert";
import { PageHeader } from "@/components/layout/page-header";
import { toLocale } from "@/i18n/routing";
import { requireUser } from "@/lib/auth/session";
import { listActiveCategories } from "@/lib/files/queries";
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
  const categories = await listActiveCategories(supabase);

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
      {session.canUpload ? (
        <>
          <div className="max-w-4xl">
            <UploadForm categories={categories} />
          </div>
          <p className="mt-4 text-xs text-muted-foreground">{t("Auth.recaptchaNotice")}</p>
        </>
      ) : (
        <div className="max-w-4xl">
          <FormAlert variant="info">{t("Upload.notAllowed")}</FormAlert>
        </div>
      )}
    </>
  );
}
