import { defineRouting } from "next-intl/routing";

export const locales = ["en", "es"] as const;
export type AppLocale = (typeof locales)[number];
export const defaultLocale: AppLocale = "en";

/** Cookie that stores the visitor's explicit language choice. */
export const LOCALE_COOKIE = "NEXT_LOCALE";

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: "always",
  // Never switch away from English based on Accept-Language. The root path is
  // resolved in the proxy from the explicit cookie choice only.
  localeDetection: false,
  // The cookie is written by our own server action when the user chooses a language.
  localeCookie: false,
});

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

/** Narrow a route param to a supported locale (falls back to the default). */
export function toLocale(value: string): AppLocale {
  return isAppLocale(value) ? value : defaultLocale;
}
