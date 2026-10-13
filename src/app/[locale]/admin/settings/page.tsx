import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { toLocale } from "@/i18n/routing";
import { requireAdmin } from "@/lib/auth/session";
import { pageMetadata } from "@/lib/seo";
import { getSiteSettings } from "@/lib/site-settings";
import { SettingsForm } from "./settings-form";

export async function generateMetadata({ params }: PageProps<"/[locale]/admin/settings">): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata({ locale: toLocale(locale), path: "/admin/settings", page: "adminSettings", noIndex: true });
}

export default async function AdminSettingsPage({ params }: PageProps<"/[locale]/admin/settings">) {
  const { locale } = await params;
  setRequestLocale(toLocale(locale));
  await requireAdmin();
  const t = await getTranslations();
  const s = await getSiteSettings();

  return (
    <>
      <PageHeader
        title={t("Admin.settings.title")}
        description={t("Admin.settings.description")}
        breadcrumbs={[{ label: t("Panel.adminTitle"), href: "/admin" }, { label: t("Admin.settings.title") }]}
      />
      <SettingsForm
        stored={s.stored}
        values={{
          phone: s.phone,
          whatsapp: s.whatsapp,
          email: s.email,
          address: s.address,
          mapsUrl: s.maps_url,
          bookingUrl: s.booking_url,
          hoursRegularEs: s.hours_regular_es,
          hoursRegularEn: s.hours_regular_en,
          hoursSeasonEs: s.hours_season_es,
          hoursSeasonEn: s.hours_season_en,
          announcementEnabled: s.announcement_enabled,
          announcementLabelEs: s.announcement_label_es,
          announcementLabelEn: s.announcement_label_en,
          announcementTextEs: s.announcement_text_es,
          announcementTextEn: s.announcement_text_en,
        }}
      />
    </>
  );
}
