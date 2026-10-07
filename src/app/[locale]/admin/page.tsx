import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { ComingSoon } from "@/components/states/coming-soon";
import { toLocale } from "@/i18n/routing";
import { requireAdmin } from "@/lib/auth/session";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/admin">): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata({ locale: toLocale(locale), path: "/admin", page: "admin", noIndex: true });
}

export default async function AdminOverviewPage({ params }: PageProps<"/[locale]/admin">) {
  const { locale } = await params;
  setRequestLocale(toLocale(locale));
  const session = await requireAdmin();
  const t = await getTranslations("Panel");

  return (
    <>
      <PageHeader
        title={t("admin.overview")}
        description={session.fullName ? t("welcome", { name: session.fullName }) : t("welcomeFallback")}
        breadcrumbs={[{ label: t("adminTitle"), href: "/admin" }, { label: t("admin.overview") }]}
      />
      <ComingSoon />
    </>
  );
}
