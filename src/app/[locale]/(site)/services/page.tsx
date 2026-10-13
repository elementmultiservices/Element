import type { Metadata } from "next";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight, Check, MessageCircle } from "lucide-react";
import { CtaPanel } from "@/components/marketing/cta-panel";
import { delay, stagger } from "@/components/marketing/motion";
import { SmartLink } from "@/components/marketing/smart-link";
import { ServicesExplorer, type ServiceGroup } from "@/components/services/services-explorer";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { getSiteContact } from "@/lib/site-settings";
import { pageMetadata } from "@/lib/seo";

const GROUPS = {
  taxes: ["personal", "businessReturn", "selfEmployed", "estimated", "salesTax", "itin"],
  business: ["registration", "payroll", "bookkeeping"],
  documents: ["translations", "immigration", "notary"],
  protection: ["lifeInsurance", "credit"],
} as const;

export async function generateMetadata({ params }: PageProps<"/[locale]/services">): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata({ locale: toLocale(locale), path: "/services", page: "services", descriptionKey: "services" });
}

export default async function ServicesPage({ params }: PageProps<"/[locale]/services">) {
  const { locale } = await params;
  setRequestLocale(toLocale(locale));
  const t = await getTranslations("ServicesPage");
  const contact = await getSiteContact();
  const tCommon = await getTranslations();
  const copy = (await getMessages()).ServicesPage;

  const groups: ServiceGroup[] = (Object.keys(GROUPS) as (keyof typeof GROUPS)[]).map((key) => ({
    key,
    ...copy.groups[key],
    items: GROUPS[key].map((item) => ({ key: item, ...copy.items[item], highlight: item === "itin" })),
  }));

  const dates = ["mar", "apr", "oct", "est"] as const;
  const bring = ["id", "ssn", "forms", "prior", "bank"] as const;

  const taxesExtras = (
    <div className="grid items-start gap-4 lg:grid-cols-[1.5fr_1fr]">
      <div style={stagger(0)} className="reveal rounded-[28px] bg-ink p-6 text-white lg:p-7">
        <p className="font-mono text-xs tracking-[0.12em] text-azure-300">{t("dates.label")}</p>
        <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {dates.map((key) => (
            <li key={key} className="flex flex-col gap-2 rounded-2xl bg-white/8 p-4 ring-1 ring-white/10">
              <span className="text-xl leading-tight font-semibold">{t(`dates.items.${key}.date`)}</span>
              <span className="text-xs leading-snug text-azure-100">{t(`dates.items.${key}.text`)}</span>
            </li>
          ))}
        </ul>
      </div>
      <div style={stagger(1)} className="reveal flex flex-col gap-4 rounded-[28px] bg-azure-25 p-6 lg:p-7">
        <h3 className="text-lg font-semibold text-ink">{t("bring.title")}</h3>
        <ul className="flex flex-col gap-2">
          {bring.map((key) => (
            <li key={key} className="flex items-center gap-2.5 text-[15px] text-navy">
              <Check aria-hidden="true" className="size-4 shrink-0 text-electric" strokeWidth={2.4} />
              {t(`bring.items.${key}`)}
            </li>
          ))}
        </ul>
        <Link href="/dashboard" className="group mt-auto inline-flex items-center gap-2 text-sm font-semibold text-ink hover:text-electric">
          {t("bring.upload")}
          <ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
    </div>
  );

  return (
    <>
      <ServicesExplorer
        bookingHref={contact.bookingHref}
        groups={groups}
        taxesExtras={taxesExtras}
        intro={
          <>
            <p style={delay(0)} className="motion-enter text-[15px] text-graphite">
              {t("eyebrow")}
            </p>
            <h1
              style={delay(1)}
              className="motion-enter text-[44px] leading-[1] font-semibold tracking-[-0.03em] text-ink sm:text-6xl lg:text-[76px]"
            >
              {t("titleStart")}
              <br />
              <span className="text-electric">{t("titleEnd")}</span>
            </h1>
            <p style={delay(2)} className="motion-enter max-w-[600px] text-base leading-relaxed text-graphite sm:text-lg">
              {t("body")}
            </p>
          </>
        }
      />
      <div className="h-16 lg:h-24" />
      <CtaPanel id="services-cta" title={t("cta.title")} body={t("cta.body")}>
        <div className="flex flex-col gap-3 sm:flex-row lg:shrink-0">
          <Button asChild size="pill-lg" className="bg-white text-ink hover:bg-azure-25">
            <SmartLink href={contact.whatsappHref}>
              <MessageCircle aria-hidden="true" />
              {tCommon("Home.hero.whatsapp")}
            </SmartLink>
          </Button>
          <Button asChild variant="brand" size="pill-lg">
            <SmartLink href={contact.bookingHref}>{tCommon("Nav.book")}</SmartLink>
          </Button>
        </div>
      </CtaPanel>
    </>
  );
}
