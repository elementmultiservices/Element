import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { ComingSoon } from "@/components/states/coming-soon";
import { toLocale } from "@/i18n/routing";
import { requireUser } from "@/lib/auth/session";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/dashboard">): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata({ locale: toLocale(locale), path: "/dashboard", page: "dashboard", noIndex: true });
}

export default async function DashboardPage({ params }: PageProps<"/[locale]/dashboard">) {
  const { locale } = await params;
  setRequestLocale(toLocale(locale));
  const session = await requireUser();
  const t = await getTranslations("Panel");

  return (
    <>
      <PageHeader
        title={t("user.files")}
        description={session.fullName ? t("welcome", { name: session.fullName }) : t("welcomeFallback")}
        breadcrumbs={[{ label: t("dashboardTitle"), href: "/dashboard" }, { label: t("user.files") }]}
      />
      <ComingSoon />
    </>
  );
}
