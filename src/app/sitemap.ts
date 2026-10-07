import type { MetadataRoute } from "next";
import { locales, type AppLocale } from "@/i18n/routing";
import { sitemapPosts } from "@/lib/blog/queries";
import { publicEnv } from "@/lib/public-env";

// Rebuilt at most once per hour; new posts appear without a redeploy.
export const revalidate = 3600;

const STATIC_PATHS = ["/", "/about", "/blog", "/contact", "/legal/privacy", "/legal/data-policy", "/legal/terms", "/legal/cookies"];

function absolute(locale: AppLocale, path: string): string {
  return `${publicEnv.siteUrl}/${locale}${path === "/" ? "" : path}`;
}

/** Public pages in both languages plus every visible post, with hreflang alternates. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];

  for (const path of STATIC_PATHS) {
    const languages = Object.fromEntries(locales.map((l) => [l, absolute(l, path)]));
    for (const locale of locales) {
      entries.push({
        url: absolute(locale, path),
        changeFrequency: path === "/blog" ? "daily" : "monthly",
        priority: path === "/" ? 1 : 0.6,
        alternates: { languages },
      });
    }
  }

  for (const post of await sitemapPosts()) {
    const available = locales.filter((l) => post.slugs[l]);
    const languages = Object.fromEntries(available.map((l) => [l, absolute(l, `/blog/${post.slugs[l]}`)]));
    for (const locale of available) {
      entries.push({
        url: absolute(locale, `/blog/${post.slugs[locale]}`),
        lastModified: new Date(post.updatedAt),
        changeFrequency: "monthly",
        priority: 0.7,
        alternates: { languages },
      });
    }
  }

  return entries;
}
