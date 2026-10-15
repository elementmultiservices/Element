import type { MetadataRoute } from "next";
import { locales, type AppLocale } from "@/i18n/routing";
import { loadIrsUpdates } from "@/lib/irs/newsroom";
import { publicEnv } from "@/lib/public-env";

// Rebuilt at most once per hour; new IRS updates appear without a redeploy.
export const revalidate = 3600;

const STATIC_PATHS = ["/", "/services", "/location", "/faq", "/updates", "/legal/privacy", "/legal/data-policy", "/legal/terms", "/legal/cookies"];

function absolute(locale: AppLocale, path: string): string {
  return `${publicEnv.siteUrl}/${locale}${path === "/" ? "" : path}`;
}

/** Public pages in both languages plus every IRS update page, with hreflang alternates. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];

  for (const path of STATIC_PATHS) {
    const languages = Object.fromEntries(locales.map((l) => [l, absolute(l, path)]));
    for (const locale of locales) {
      entries.push({
        url: absolute(locale, path),
        changeFrequency: path === "/updates" ? "daily" : "monthly",
        priority: path === "/" ? 1 : 0.6,
        alternates: { languages },
      });
    }
  }

  // An update is listed in each language the IRS published it in.
  const lists = await Promise.all(locales.map(async (locale) => [locale, (await loadIrsUpdates(locale)) ?? []] as const));
  const bySlug = new Map<string, { locale: AppLocale; date: string }[]>();
  for (const [locale, updates] of lists) {
    for (const u of updates) if (u.slug) bySlug.set(u.slug, [...(bySlug.get(u.slug) ?? []), { locale, date: u.date }]);
  }
  for (const [slug, versions] of bySlug) {
    const languages = Object.fromEntries(versions.map((v) => [v.locale, absolute(v.locale, `/updates/${slug}`)]));
    for (const v of versions) {
      entries.push({
        url: absolute(v.locale, `/updates/${slug}`),
        lastModified: new Date(v.date),
        changeFrequency: "monthly",
        priority: 0.7,
        alternates: { languages },
      });
    }
  }

  return entries;
}
