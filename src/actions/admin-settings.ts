"use server";

import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/session";
import { fieldErrorsFrom, type FormState } from "@/lib/forms";
import { rateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { siteSettingsSchema, type SiteSettingsField } from "@/lib/validation/admin";

/** Table or column missing: the site_settings migration has not been applied yet. */
const MISSING_RELATION = new Set(["42P01", "PGRST205", "PGRST204", "42703"]);

/** Saves the public business details (contact, location, hours, announcement bar). */
export async function updateSiteSettingsAction(
  _prev: FormState<SiteSettingsField>,
  formData: FormData,
): Promise<FormState<SiteSettingsField>> {
  const session = await requireAdmin();
  if (!(await rateLimit("adminActionUser", session.userId)).success) return { status: "error", error: "rateLimited" };

  const field = (key: string) => {
    const v = formData.get(key);
    return typeof v === "string" ? v : "";
  };
  const parsed = siteSettingsSchema.safeParse({
    phone: field("phone"),
    whatsapp: field("whatsapp"),
    email: field("email"),
    address: field("address"),
    mapsUrl: field("mapsUrl"),
    bookingUrl: field("bookingUrl"),
    hoursRegularEs: field("hoursRegularEs"),
    hoursRegularEn: field("hoursRegularEn"),
    hoursSeasonEs: field("hoursSeasonEs"),
    hoursSeasonEn: field("hoursSeasonEn"),
    announcementEnabled: formData.get("announcementEnabled") ?? undefined,
    announcementLabelEs: field("announcementLabelEs"),
    announcementLabelEn: field("announcementLabelEn"),
    announcementTextEs: field("announcementTextEs"),
    announcementTextEn: field("announcementTextEn"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom<SiteSettingsField>(parsed.error) };
  const d = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("site_settings")
    .update({
      phone: d.phone,
      whatsapp: d.whatsapp,
      email: d.email,
      address: d.address,
      maps_url: d.mapsUrl,
      booking_url: d.bookingUrl,
      hours_regular_es: d.hoursRegularEs,
      hours_regular_en: d.hoursRegularEn,
      hours_season_es: d.hoursSeasonEs,
      hours_season_en: d.hoursSeasonEn,
      announcement_enabled: d.announcementEnabled,
      announcement_label_es: d.announcementLabelEs,
      announcement_label_en: d.announcementLabelEn,
      announcement_text_es: d.announcementTextEs,
      announcement_text_en: d.announcementTextEn,
      updated_by: session.userId,
    })
    .eq("id", true)
    .select("id")
    .maybeSingle();

  if (error) {
    if (MISSING_RELATION.has(error.code)) return { status: "error", error: "migrationPending" };
    console.error(`[settings] update failed: ${error.code}`);
    return { status: "error", error: "generic" };
  }
  if (!data) return { status: "error", error: "migrationPending" };

  await audit({
    actorId: session.userId,
    action: "admin.settings_updated",
    targetType: "settings",
    targetId: "site",
    metadata: { phone: d.phone, address: d.address, announcement: d.announcementEnabled },
  });
  return { status: "success" };
}
