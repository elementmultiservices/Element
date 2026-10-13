/**
 * Helpers for the public business details. The values themselves are edited by
 * administrators (site_settings, see src/lib/site-settings.ts); links fall back
 * to the contact page while a value is missing.
 */

export const isExternal = (href: string) => /^(https?:|tel:|mailto:)/.test(href);

/** "+1 (917) 890-0892" -> "tel:+19178900892". */
export function phoneHrefFor(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  return digits.replace(/\D/g, "").length >= 7 ? `tel:${digits}` : "/contact";
}

export function whatsappHrefFor(whatsapp: string): string {
  const digits = whatsapp.replace(/\D/g, "");
  return digits.length >= 7 ? `https://wa.me/${digits}` : "/contact";
}

/** Splits a multi-line field into its non-empty lines. */
export function lines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}
