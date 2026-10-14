import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { getLocale } from "next-intl/server";
import { toLocale } from "@/i18n/routing";
import { CONTACT_FALLBACK, lines, phoneHrefFor, whatsappHrefFor } from "@/lib/business";
import type { Database } from "@/lib/supabase/database.types";
import { createPublicClient } from "@/lib/supabase/public";

export type SiteSettings = Omit<Database["public"]["Tables"]["site_settings"]["Row"], "id" | "updated_by">;

/**
 * Used until the site_settings migration is applied (or if it cannot be read),
 * so the public site never breaks because of a missing row.
 */
export const DEFAULT_SETTINGS: SiteSettings = {
  phone: "+1 (917) 890-0892",
  whatsapp: "19178900892",
  email: "",
  address: "",
  maps_url: "",
  booking_url: "",
  hours_regular_es: "Lun – Vie · 10:00 a. m. – 6:00 p. m.\nSábados · con cita\nDomingos · cerrado",
  hours_regular_en: "Mon – Fri · 10:00 a.m. – 6:00 p.m.\nSaturday · by appointment\nSunday · closed",
  hours_season_es: "Lun – Sáb · 9:00 a. m. – 8:00 p. m.\nDomingos · con cita",
  hours_season_en: "Mon – Sat · 9:00 a.m. – 8:00 p.m.\nSunday · by appointment",
  announcement_enabled: true,
  announcement_label_es: "15 OCT",
  announcement_label_en: "OCT 15",
  announcement_text_es: "¿Pediste extensión? Te ayudamos a presentar tu declaración a tiempo.",
  announcement_text_en: "Filed an extension? We'll help you file your return on time.",
  updated_at: new Date(0).toISOString(),
};

/** Cache tag of the settings row; expired by the admin settings action. */
export const SITE_SETTINGS_TAG = "site-settings";

class SettingsReadError extends Error {
  constructor(readonly code: string) {
    super(`[settings] read failed: ${code}`);
  }
}

/**
 * The settings row, shared across requests (every public page reads it).
 * Errors throw so they are never cached; the admin save expires the tag.
 */
const readStoredSettings = unstable_cache(
  async (): Promise<SiteSettings | null> => {
    const { data, error } = await createPublicClient().from("site_settings").select("*").eq("id", true).maybeSingle();
    if (error) throw new SettingsReadError(error.code);
    if (!data) return null;
    const { id: _id, updated_by: _by, ...settings } = data;
    return settings;
  },
  ["site-settings"],
  { tags: [SITE_SETTINGS_TAG], revalidate: 3600 },
);

/** Raw settings row. */
export const getSiteSettings = cache(async (): Promise<SiteSettings & { stored: boolean }> => {
  try {
    const settings = await readStoredSettings();
    return settings ? { ...settings, stored: true } : { ...DEFAULT_SETTINGS, stored: false };
  } catch (error) {
    // PGRST205 / 42P01: table not created yet (migration pending); defaults are expected.
    if (error instanceof SettingsReadError && error.code !== "PGRST205" && error.code !== "42P01") console.error(error.message);
    return { ...DEFAULT_SETTINGS, stored: false };
  }
});

export type SiteContact = {
  phone: string;
  phoneHref: string;
  whatsappHref: string;
  email: string;
  address: string;
  mapsHref: string;
  bookingHref: string;
  hoursRegular: string[];
  hoursSeason: string[];
  announcement: { label: string; text: string } | null;
};

/** Contact details ready to render, in the active language. */
export const getSiteContact = cache(async (): Promise<SiteContact> => {
  const s = await getSiteSettings();
  const locale = toLocale(await getLocale());
  const text = locale === "es" ? s.announcement_text_es : s.announcement_text_en;
  return {
    phone: s.phone,
    phoneHref: phoneHrefFor(s.phone),
    whatsappHref: whatsappHrefFor(s.whatsapp),
    email: s.email,
    address: s.address,
    mapsHref: s.maps_url || CONTACT_FALLBACK,
    bookingHref: s.booking_url || CONTACT_FALLBACK,
    hoursRegular: lines(locale === "es" ? s.hours_regular_es : s.hours_regular_en),
    hoursSeason: lines(locale === "es" ? s.hours_season_es : s.hours_season_en),
    announcement:
      s.announcement_enabled && text.trim()
        ? { label: (locale === "es" ? s.announcement_label_es : s.announcement_label_en).trim(), text: text.trim() }
        : null,
  };
});
