import type { Metadata } from "next";
import type { Messages } from "next-intl";
import { getTranslations } from "next-intl/server";
import { locales, type AppLocale } from "@/i18n/routing";

type PageKey = keyof Messages["Metadata"]["pages"];
type DescriptionKey = keyof Messages["Metadata"]["descriptions"];

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
  /** Overrides the page title (e.g. a post title). */
  title?: string;
  description?: string;
  descriptionKey?: DescriptionKey;
  /** Per-locale paths when they differ (e.g. translated slugs) or only some locales exist. */
  paths?: Partial<Record<AppLocale, string>>;
  image?: string | null;
  type?: "website" | "article";
  publishedTime?: string;
}): Promise<Metadata> {
  const t = await getTranslations({ locale: options.locale, namespace: "Metadata" });
  const title = options.title ?? t(`pages.${options.page}`);
  const description = options.description || (options.descriptionKey ? t(`descriptions.${options.descriptionKey}`) : t("description"));
  const suffix = options.path === "/" ? "" : options.path;
  const url = `/${options.locale}${suffix}`;

  let languages: Record<string, string> = languageAlternates(options.path);
  if (options.paths) {
    languages = {};
    for (const [l, p] of Object.entries(options.paths)) languages[l] = `/${l}${p}`;
    const fallback = options.paths.en ?? options.paths[options.locale];
    if (fallback) languages["x-default"] = `/${options.paths.en ? "en" : options.locale}${fallback}`;
  }

  const ogLocale = (l: AppLocale) => (l === "es" ? "es_CO" : "en_US");
  const otherLocales = (options.paths ? (Object.keys(options.paths) as AppLocale[]) : [...locales]).filter((l) => l !== options.locale);

  return {
    title,
    description,
    alternates: { canonical: url, languages },
    openGraph: {
      type: options.type ?? "website",
      siteName: t("siteName"),
      title: `${title} | ${t("siteName")}`,
      description,
      url,
      locale: ogLocale(options.locale),
      alternateLocale: otherLocales.map(ogLocale),
      ...(options.image ? { images: [{ url: options.image }] } : {}),
      ...(options.publishedTime ? { publishedTime: options.publishedTime } : {}),
    },
    twitter: { card: options.image ? "summary_large_image" : "summary", title: `${title} | ${t("siteName")}`, description },
    robots: options.noIndex ? { index: false, follow: false } : undefined,
  };
}
