import type { Metadata } from "next";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight, ArrowUpRight, MapPin, MessageCircle, Phone } from "lucide-react";
import { IRS_REFUND_URL, REFUND_STATUS_ID } from "@/components/layout/site-nav";
import { Accordion, type AccordionItem } from "@/components/marketing/accordion";
import { delay, stagger } from "@/components/marketing/motion";
import { SmartLink } from "@/components/marketing/smart-link";
import { StateRefundDialog } from "@/components/marketing/state-refund-dialog";
import { Button } from "@/components/ui/button";
import { toLocale } from "@/i18n/routing";
import { getSiteContact } from "@/lib/site-settings";
import { pageMetadata } from "@/lib/seo";

const GROUPS = {
  refunds: ["timing", "status", "delay"],
  documents: ["bring", "noForms", "noSsn"],
  pricing: ["estimate", "fees", "payment"],
  mustFile: ["benefits", "noWork", "selfEmployed"],
  irs: ["pastYears", "amend", "owe", "letter"],
  services: ["deadline", "remote", "secure", "business", "yearRound"],
} as const;

type GroupKey = keyof typeof GROUPS;

const REFUND_LINK_CLASS =
  "inline-flex items-center gap-1.5 rounded-xl bg-azure-25 px-3.5 py-2 text-sm font-semibold text-electric hover:bg-azure-50";

export async function generateMetadata({ params }: PageProps<"/[locale]/faq">): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata({ locale: toLocale(locale), path: "/faq", page: "faq", descriptionKey: "faq" });
}

export default async function FaqPage({ params }: PageProps<"/[locale]/faq">) {
  const { locale } = await params;
  setRequestLocale(toLocale(locale));
  const t = await getTranslations();
  const contact = await getSiteContact();
  const copy = (await getMessages()).FaqPage.groups;
  const keys = Object.keys(GROUPS) as GroupKey[];
  const total = keys.reduce((n, k) => n + GROUPS[k].length, 0);
  const entry = (group: GroupKey, item: string) => (copy[group].items as Record<string, { q: string; a: string }>)[item] ?? { q: "", a: "" };

  // Answers that need more than a paragraph (links, lists) are built here.
  const answer = (group: GroupKey, item: string): AccordionItem["a"] => {
    if (group === "refunds" && item === "status") {
      const s = copy.refunds.items.status;
      return (
        <div className="flex flex-col gap-4">
          <p>{s.a}</p>
          <ul className="flex flex-col items-start gap-2">
            <li>
              <a href={IRS_REFUND_URL} target="_blank" rel="noopener noreferrer" className={REFUND_LINK_CLASS}>
                {s.federal}
                <ArrowUpRight aria-hidden="true" className="size-4" />
              </a>
            </li>
            <li>
              <StateRefundDialog triggerClassName={REFUND_LINK_CLASS} />
            </li>
          </ul>
          <p>{s.after}</p>
        </div>
      );
    }
    if (group === "documents" && item === "bring") {
      const b = copy.documents.items.bring;
      return (
        <div className="flex flex-col gap-3">
          <p>{b.a}</p>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 marker:text-electric">
            {Object.entries(b.list).map(([k, v]) => (
              <li key={k}>
                <strong className="font-semibold text-ink">{v.label}:</strong> {v.text}
              </li>
            ))}
          </ul>
        </div>
      );
    }
    return <p>{entry(group, item).a}</p>;
  };

  // FAQPage structured data for search results (plain-text answers only).
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: keys.flatMap((g) =>
      GROUPS[g].map((item) => ({
        "@type": "Question",
        name: entry(g, item).q,
        acceptedAnswer: { "@type": "Answer", text: entry(g, item).a },
      })),
    ),
  };

  const cards = [
    { key: "whatsapp", icon: MessageCircle, href: contact.whatsappHref, body: t("FaqPage.cta.whatsapp.body") },
    { key: "call", icon: Phone, href: contact.phoneHref, body: [contact.phone, contact.hoursRegular[0]].filter(Boolean).join(" · ") },
    { key: "visit", icon: MapPin, href: contact.mapsHref, body: contact.address },
  ] as const;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <section className="px-4 pt-4 sm:px-6">
        <div className="relative mx-auto flex max-w-[1240px] flex-col items-center gap-6 overflow-hidden rounded-[28px] bg-[linear-gradient(180deg,#F0F7FF_0%,#DDEEFD_100%)] px-5 py-14 text-center sm:px-10 lg:rounded-[40px] lg:py-20">
          <span aria-hidden="true" className="motion-float absolute -top-32 -right-24 size-80 rounded-full bg-white/70 blur-3xl" />
          <p style={delay(0)} className="motion-enter relative rounded-full border border-azure-100 bg-white px-4 py-2 text-sm text-navy">
            {t("FaqPage.badge", { count: total })}
          </p>
          <h1
            style={delay(1)}
            className="motion-enter relative text-[44px] leading-[1] font-semibold tracking-[-0.03em] text-ink sm:text-6xl lg:text-[76px]"
          >
            {t("FaqPage.titleStart")}
            <br />
            <span className="text-electric">{t("FaqPage.titleAccent")}</span>
          </h1>
          <p style={delay(2)} className="motion-enter relative max-w-[620px] text-base leading-relaxed text-graphite sm:text-lg">
            {t("FaqPage.body")}
          </p>
          <nav style={delay(3)} aria-label={t("FaqPage.badge", { count: total })} className="motion-enter relative flex flex-wrap justify-center gap-2">
            {keys.map((g) => (
              <a key={g} href={`#${g}`} className="rounded-full bg-white px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-azure-50">
                {copy[g].title}
              </a>
            ))}
          </nav>
        </div>
      </section>

      <div className="mx-auto grid w-full max-w-[1240px] gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[300px_1fr] lg:gap-14 lg:py-24">
        <aside className="order-last lg:sticky lg:top-32 lg:order-none lg:self-start">
          <div className="reveal flex flex-col gap-4 rounded-[28px] bg-ink p-7 text-white">
            <h2 className="text-2xl leading-tight font-semibold text-white">{t("FaqPage.aside.title")}</h2>
            <p className="text-[15px] leading-relaxed text-azure-100">{t("FaqPage.aside.body")}</p>
            <Button asChild size="pill" className="mt-2 bg-white text-ink hover:bg-azure-25">
              <SmartLink href={contact.whatsappHref}>
                <MessageCircle aria-hidden="true" />
                {t("Nav.whatsapp")}
              </SmartLink>
            </Button>
            <Button asChild variant="brand" size="pill">
              <SmartLink href={contact.bookingHref}>{t("Nav.book")}</SmartLink>
            </Button>
          </div>
        </aside>

        <div className="flex flex-col gap-14 lg:gap-16">
          {keys.map((g, i) => (
            <section key={g} id={g} aria-labelledby={`faq-${g}`} className="scroll-mt-32">
              <div className="reveal mb-5 flex items-center gap-4 border-b border-azure-50 pb-4">
                <span className="font-mono text-sm text-electric">{String(i + 1).padStart(2, "0")}</span>
                <h2 id={`faq-${g}`} className="flex-1 text-2xl font-semibold tracking-[-0.01em] text-ink sm:text-[28px]">
                  {copy[g].title}
                </h2>
                <span className="font-mono text-xs text-graphite">{t("FaqPage.count", { count: GROUPS[g].length })}</span>
              </div>
              <Accordion
                variant="cards"
                className="reveal"
                defaultOpen={i === 0 ? 0 : null}
                items={GROUPS[g].map((item) => ({
                  q: entry(g, item).q,
                  a: answer(g, item),
                  id: g === "refunds" && item === "status" ? REFUND_STATUS_ID : undefined,
                }))}
              />
            </section>
          ))}
        </div>
      </div>

      <section aria-labelledby="faq-cta" className="px-4 pb-16 sm:px-6 lg:pb-24">
        <div className="reveal relative mx-auto max-w-[1240px] overflow-hidden rounded-[28px] bg-[linear-gradient(150deg,#050D29_0%,#13295A_60%,#2B56B3_100%)] px-6 py-14 text-white sm:px-12 lg:rounded-[40px] lg:px-16">
          <span aria-hidden="true" className="motion-float absolute -top-24 -right-16 size-72 rounded-full bg-sky/20 blur-3xl" />
          <div className="relative flex max-w-[620px] flex-col gap-4">
            <h2 id="faq-cta" className="text-[34px] leading-[1.05] font-semibold tracking-[-0.02em] text-white sm:text-5xl">
              {t("FaqPage.cta.title")}
            </h2>
            <p className="text-base leading-relaxed text-azure-100 sm:text-lg">{t("FaqPage.cta.body")}</p>
          </div>
          <ul className="relative mt-10 grid gap-3 md:grid-cols-3">
            {cards.map(({ key, icon: Icon, href, body }, i) => (
              <li key={key} style={stagger(i)} className="reveal">
                <SmartLink
                  href={href}
                  className="group flex h-full flex-col gap-3 rounded-[22px] bg-white/6 p-5 ring-1 ring-white/10 transition-colors hover:bg-white/10"
                >
                  <Icon aria-hidden="true" className="size-5 text-azure-300" />
                  <span className="text-lg font-semibold">{t(`FaqPage.cta.${key}.title`)}</span>
                  {body ? <span className="text-sm text-azure-100">{body}</span> : null}
                  <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-sm font-semibold text-white">
                    {t(`FaqPage.cta.${key}.action`)}
                    <ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </SmartLink>
              </li>
            ))}
          </ul>
        </div>
        <p className="mx-auto mt-6 max-w-[1240px] text-center text-xs text-graphite">{t("FaqPage.disclaimer")}</p>
      </section>
    </>
  );
}
