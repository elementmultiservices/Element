import type { SiteContact } from "@/lib/site-settings";

/** "2330 Cambreleng Ave, Bronx, NY 10458" -> PostalAddress parts, or null when it does not follow that shape. */
export function postalAddress(address: string) {
  const match = /^(.+?),\s*([^,]+?),\s*([A-Za-z]{2})\.?\s+(\d{5}(?:-\d{4})?)$/.exec(address.trim());
  if (!match) return null;
  const [, streetAddress, addressLocality, region, postalCode] = match;
  return {
    "@type": "PostalAddress",
    streetAddress: streetAddress!.trim(),
    addressLocality: addressLocality!.trim(),
    addressRegion: region!.toUpperCase(),
    postalCode,
    addressCountry: "US",
  };
}

/**
 * schema.org description of the office (name, address, phone, map) for search
 * engines and the answers they generate. Built from the business details edited
 * in the admin, so it always matches what the site shows.
 */
export function localBusinessJsonLd(input: { contact: SiteContact; name: string; alternateName: string; description: string; url: string }) {
  const { contact } = input;
  const phone = contact.phoneHref.startsWith("tel:") ? contact.phoneHref.slice(4) : undefined;
  return {
    "@context": "https://schema.org",
    "@type": "AccountingService",
    "@id": `${input.url}/#business`,
    name: input.name,
    alternateName: input.alternateName,
    description: input.description,
    url: input.url,
    ...(contact.address ? { address: postalAddress(contact.address) ?? contact.address } : {}),
    ...(phone ? { telephone: phone } : {}),
    ...(contact.email ? { email: contact.email } : {}),
    ...(contact.mapsHref.startsWith("http") ? { hasMap: contact.mapsHref } : {}),
    areaServed: "New York",
    knowsLanguage: ["es", "en"],
  };
}

/** Serializes JSON-LD for a <script> tag (no "</script>" breakout). */
export function jsonLdHtml(data: object): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
