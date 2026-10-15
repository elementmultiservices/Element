import "server-only";
import { createElement } from "react";
import { render } from "@react-email/render";
import { Resend } from "resend";
import { getTranslations } from "next-intl/server";
import { locales, type AppLocale } from "@/i18n/routing";
import { isProduction, serverEnv } from "@/lib/env";
import type { IrsUpdate } from "@/lib/irs/newsroom";
import { NewsletterEmail } from "@/lib/email/templates/newsletter-email";

/** Resend accepts up to 100 messages per batch request. */
const BATCH_SIZE = 100;

export type Recipient = { email: string; locale: AppLocale; token: string };

export function siteUrl(): string {
  return serverEnv().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
}

export function unsubscribeUrl(locale: AppLocale, token: string): string {
  return `${siteUrl()}/${locale}/newsletter/unsubscribe?token=${token}`;
}

type Rendered = { subject: string; html: string; text: string };

/** The same IRS update in each language the IRS published it in. */
export type UpdateVersions = Partial<Record<AppLocale, IrsUpdate>>;

/**
 * Emails an IRS update to every recipient, in their language when the IRS
 * published it in that language (otherwise in the other one). The email links
 * to the update's page on our site. Each message carries its own unsubscribe
 * link and one-click List-Unsubscribe headers.
 */
export async function sendUpdateToSubscribers(
  slug: string,
  versions: UpdateVersions,
  recipients: Recipient[],
  footerAddress: string,
): Promise<{ sent: number; failed: number }> {
  const env = serverEnv();

  // One rendered template per language; the unsubscribe URL is substituted per recipient.
  const PLACEHOLDER = "__UNSUBSCRIBE_URL__";
  const rendered = new Map<AppLocale, Rendered>();
  for (const locale of locales) {
    const contentLocale: AppLocale = versions[locale] ? locale : locale === "es" ? "en" : "es";
    const update = versions[contentLocale];
    if (!update) continue;
    const t = await getTranslations({ locale, namespace: "Newsletter.email" });
    const react = createElement(NewsletterEmail, {
      locale,
      eyebrow: t("eyebrow"),
      title: update.title,
      excerpt: update.summary,
      logoUrl: `${siteUrl()}/brand/element-logo-email.png`,
      coverUrl: null,
      ctaLabel: t("cta"),
      postUrl: `${siteUrl()}/${contentLocale}/updates/${slug}`,
      reason: t("reason"),
      unsubscribeLabel: t("unsubscribe"),
      unsubscribeUrl: PLACEHOLDER,
      footerAddress: footerAddress ? `Element Multiservices · ${footerAddress}` : "Element Multiservices",
    });
    rendered.set(locale, {
      subject: update.title.replace(/[\r\n\t]+/g, " ").slice(0, 150),
      html: await render(react),
      text: await render(react, { plainText: true }),
    });
  }

  const messages = recipients.flatMap((r) => {
    const m = rendered.get(r.locale) ?? rendered.get("es") ?? rendered.get("en");
    if (!m) return [];
    const url = unsubscribeUrl(r.locale, r.token);
    return [
      {
        to: r.email,
        subject: m.subject,
        html: m.html.replaceAll(PLACEHOLDER, url),
        text: m.text.replaceAll(PLACEHOLDER, url),
        headers: {
          "List-Unsubscribe": `<${siteUrl()}/api/newsletter/unsubscribe?token=${r.token}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      },
    ];
  });

  // Development without an API key: show one sample instead of sending.
  if (!env.RESEND_API_KEY) {
    if (isProduction) return { sent: 0, failed: messages.length };
    if (messages[0]) console.info(`\n[newsletter:dev] ${messages.length} recipient(s). Sample to ${messages[0].to}:\n${messages[0].text}\n`);
    return { sent: messages.length, failed: 0 };
  }

  const resend = new Resend(env.RESEND_API_KEY);
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const chunk = messages.slice(i, i + BATCH_SIZE).map((m) => ({ from: env.EMAIL_FROM, ...m }));
    try {
      const { error } = await resend.batch.send(chunk);
      if (error) {
        console.error(`[newsletter] batch failed: ${error.name}`);
        failed += chunk.length;
      } else {
        sent += chunk.length;
      }
    } catch {
      console.error("[newsletter] batch threw");
      failed += chunk.length;
    }
  }
  return { sent, failed };
}
