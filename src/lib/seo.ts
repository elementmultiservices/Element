import type { Metadata } from "next";
import type { Messages } from "next-intl";
import { getTranslations } from "next-intl/server";
import { locales, type AppLocale } from "@/i18n/routing";

type PageKey = keyof Messages["Metadata"]["pages"];

/** hreflang alternates for a locale-independent path ("/", "/about", …). */
export function languageAlternates(path: string): Record<string, string> {
  const suffix = path === "/" ? "" : path;
  const entries: Record<string, string> = Object.fromEntries(locales.map((l) => [l, `/${l}${suffix}`]));
  entries["x-default"] = `/en${suffix}`;
  return entries;
}

/** Localized title/description, canonical, hreflang and Open Graph for a page. */
export async function pageMetadata(options: {
  locale: AppLocale;
  path: string;
  page: PageKey;
  noIndex?: boolean;
}): Promise<Metadata> {
  const t = await getTranslations({ locale: options.locale, namespace: "Metadata" });
  const title = t(`pages.${options.page}`);
  const description = t("description");
  const suffix = options.path === "/" ? "" : options.path;
  const url = `/${options.locale}${suffix}`;

  return {
    title,
    description,
    alternates: { canonical: url, languages: languageAlternates(options.path) },
    openGraph: {
      type: "website",
      siteName: t("siteName"),
      title: `${title} | ${t("siteName")}`,
      description,
      url,
      locale: options.locale === "es" ? "es_CO" : "en_US",
      alternateLocale: options.locale === "es" ? ["en_US"] : ["es_CO"],
    },
    robots: options.noIndex ? { index: false, follow: false } : undefined,
  };
}
