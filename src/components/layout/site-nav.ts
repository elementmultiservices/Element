export const publicNav = [
  { href: "/services", key: "services" },
  { href: "/location", key: "location" },
  { href: "/updates", key: "updates" },
  { href: "/faq", key: "faq" },
] as const;

export const footerSiteNav = [
  { href: "/location", key: "location" },
  { href: "/updates", key: "updates" },
  { href: "/faq", key: "faqLong" },
] as const;

export const footerServicesNav = ["taxes", "itin", "business", "documents"] as const;

export const legalNav = [
  { href: "/legal/privacy", key: "privacy" },
  { href: "/legal/data-policy", key: "dataPolicy" },
  { href: "/legal/terms", key: "terms" },
  { href: "/legal/cookies", key: "cookies" },
] as const;

/** True when `pathname` is `href` or one of its sub-pages. */
export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
