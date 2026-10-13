/**
 * Helpers for the public business details. The values themselves are edited by
 * administrators (site_settings, see src/lib/site-settings.ts); links fall back
 * to the question form on the location page while a value is missing.
 */

export const CONTACT_FALLBACK = "/location#contact-form";

export const isExternal = (href: string) => /^(https?:|tel:|mailto:)/.test(href);

/** "+1 (917) 890-0892" -> "tel:+19178900892". */
export function phoneHrefFor(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  return digits.replace(/\D/g, "").length >= 7 ? `tel:${digits}` : CONTACT_FALLBACK;
}

export function whatsappHrefFor(whatsapp: string): string {
  const digits = whatsapp.replace(/\D/g, "");
  return digits.length >= 7 ? `https://wa.me/${digits}` : CONTACT_FALLBACK;
}

/** Splits a multi-line field into its non-empty lines. */
export function lines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}
