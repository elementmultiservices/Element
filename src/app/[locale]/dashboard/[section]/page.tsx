import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { ComingSoon } from "@/components/states/coming-soon";
import { toLocale } from "@/i18n/routing";
import { requireUser } from "@/lib/auth/session";
import { pageMetadata } from "@/lib/seo";

// Placeholder routes for sections delivered in phase 2 (replaced by real pages).
const sections = ["profile"] as const;
type Section = (typeof sections)[number];
const isSection = (v: string): v is Section => (sections as readonly string[]).includes(v);

export async function generateMetadata({ params }: PageProps<"/[locale]/dashboard/[section]">): Promise<Metadata> {
  const { locale, section } = await params;
  return pageMetadata({ locale: toLocale(locale), path: `/dashboard/${section}`, page: "dashboard", noIndex: true });
}

export default async function DashboardSectionPage({ params }: PageProps<"/[locale]/dashboard/[section]">) {
  const { locale, section } = await params;
  setRequestLocale(toLocale(locale));
  if (!isSection(section)) notFound();
  await requireUser();
  const t = await getTranslations("Panel");

  return (
    <>
      <PageHeader
        title={t(`user.${section}`)}
        breadcrumbs={[{ label: t("dashboardTitle"), href: "/dashboard" }, { label: t(`user.${section}`) }]}
      />
      <ComingSoon />
    </>
  );
}
