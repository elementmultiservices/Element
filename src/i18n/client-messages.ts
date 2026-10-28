import "server-only";
import type { AbstractIntlMessages } from "next-intl";
import { getMessages } from "next-intl/server";

/**
 * Namespaces read by client components anywhere on the site (header, cookie
 * notice, error boundary, public forms). Server components read every message
 * on the server; only these travel to the browser.
 */
const SHARED = [
  "Common",
  "Nav",
  "CookieNotice",
  "ErrorPage",
  "Errors",
  "Validation",
  "Auth",
  "Contact",
  "Newsletter",
  "FaqPage.refundStates", // state refund dialog in the header menu
];

/**
 * Messages for a NextIntlClientProvider: the shared namespaces plus `extra`
 * ("Admin" or a nested path such as "Admin.files"). A nested provider replaces
 * its parent's messages, so it must list everything its subtree needs.
 */
export async function clientMessages(...extra: string[]): Promise<AbstractIntlMessages> {
  type Tree = Record<string, unknown>;
  const all = (await getMessages()) as unknown as Tree;
  const picked: Tree = {};
  for (const path of [...SHARED, ...extra]) {
    const keys = path.split(".");
    let source: unknown = all;
    let target = picked;
    keys.forEach((key, i) => {
      source = source && typeof source === "object" ? (source as Tree)[key] : undefined;
      if (source === undefined) return;
      if (i === keys.length - 1) target[key] = source;
      else target = (target[key] ??= {}) as Tree;
    });
  }
  return picked as AbstractIntlMessages;
}
