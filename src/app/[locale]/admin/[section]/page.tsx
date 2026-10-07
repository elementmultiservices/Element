import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { ComingSoon } from "@/components/states/coming-soon";
import { toLocale } from "@/i18n/routing";
import { requireAdmin } from "@/lib/auth/session";
import { pageMetadata } from "@/lib/seo";

// Placeholder routes for sections delivered in phases 3 and 4 (replaced by real pages).
const sections = ["users", "files", "trash", "categories", "blog", "messages", "audit"] as const;
type Section = (typeof sections)[number];
const isSection = (v: string): v is Section => (sections as readonly string[]).includes(v);

export async function generateMetadata({ params }: PageProps<"/[locale]/admin/[section]">): Promise<Metadata> {
  const { locale, section } = await params;
  return pageMetadata({ locale: toLocale(locale), path: `/admin/${section}`, page: "admin", noIndex: true });
}

export default async function AdminSectionPage({ params }: PageProps<"/[locale]/admin/[section]">) {
  const { locale, section } = await params;
  setRequestLocale(toLocale(locale));
  if (!isSection(section)) notFound();
  await requireAdmin();
  const t = await getTranslations("Panel");

  return (
    <>
      <PageHeader
        title={t(`admin.${section}`)}
        breadcrumbs={[{ label: t("adminTitle"), href: "/admin" }, { label: t(`admin.${section}`) }]}
      />
      <ComingSoon />
    </>
  );
}
