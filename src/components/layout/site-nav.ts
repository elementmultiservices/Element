export const publicNav = [
  { href: "/services", key: "services" },
  { href: "/what-to-bring", key: "bring" },
  { href: "/location", key: "location" },
  { href: "/faq#refund-status", key: "refund" },
  { href: "/faq", key: "faq" },
] as const;

export const IRS_REFUND_URL = "https://sa.www4.irs.gov/wmr/";

/** FAQ answer about refund status; the accordion opens it when the URL hash matches. */
export const REFUND_STATUS_ID = "refund-status";

export const footerSiteNav = [
  { href: "/location", key: "location" },
  { href: "/updates", key: "updates" },
  { href: "/what-to-bring", key: "bring" },
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
