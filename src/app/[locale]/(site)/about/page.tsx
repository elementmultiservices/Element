import type { Metadata } from "next";
import { Check, Compass, HandHeart, MessageCircle, Target } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { stagger } from "@/components/marketing/motion";
import { PageHero } from "@/components/marketing/page-hero";
import { container } from "@/components/marketing/section-intro";
import { Button } from "@/components/ui/button";
import { SmartLink } from "@/components/marketing/smart-link";
import { toLocale } from "@/i18n/routing";
import { getSiteContact } from "@/lib/site-settings";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/about">): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata({ locale: toLocale(locale), path: "/about", page: "about", descriptionKey: "about" });
}

export default async function AboutPage({ params }: PageProps<"/[locale]/about">) {
  const { locale } = await params;
  setRequestLocale(toLocale(locale));
  const t = await getTranslations("About");
  const contact = await getSiteContact();
  const tn = await getTranslations("Nav");
  const sections = [
    { key: "mission", icon: Target },
    { key: "approach", icon: Compass },
    { key: "commitment", icon: HandHeart },
  ] as const;
  const values = ["confidentiality", "traceability", "availability", "service"] as const;

  return (
    <>
      <PageHero eyebrow={t("eyebrow")} title={t("title")} body={t("intro")} />

      <div className={`${container} flex flex-col gap-16 py-16 lg:gap-24 lg:py-24`}>
        <ul className="grid gap-4 md:grid-cols-3">
          {sections.map(({ key, icon: Icon }, i) => (
            <li
              key={key}
              style={stagger(i)}
              className="reveal flex flex-col gap-4 rounded-[28px] border border-azure-50 bg-white p-7 transition-[translate,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(5,13,41,0.08)] lg:p-8"
            >
              <span className="flex size-12 items-center justify-center rounded-full bg-ink text-white">
                <Icon aria-hidden="true" className="size-5" />
              </span>
              <p className="font-mono text-xs tracking-[0.12em] text-electric">{String(i + 1).padStart(2, "0")}</p>
              <h2 className="text-2xl font-semibold text-ink">{t(`sections.${key}.title`)}</h2>
              <p className="text-base leading-relaxed text-graphite">{t(`sections.${key}.body`)}</p>
            </li>
          ))}
        </ul>

        <section aria-labelledby="values-title" className="grid gap-10 lg:grid-cols-[1fr_1.3fr] lg:gap-14">
          <div className="reveal flex flex-col items-start gap-6">
            <h2 id="values-title" className="text-[34px] leading-[1.05] font-semibold tracking-[-0.02em] text-ink sm:text-5xl">
              {t("valuesHeading")}
            </h2>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild variant="ink" size="pill-lg">
                <SmartLink href={contact.whatsappHref}>
                  <MessageCircle aria-hidden="true" />
                  {t("contactCta")}
                </SmartLink>
              </Button>
              <Button asChild variant="brand" size="pill-lg">
                <SmartLink href={contact.bookingHref}>{tn("book")}</SmartLink>
              </Button>
            </div>
          </div>
          <ul className="flex flex-col">
            {values.map((key, i) => (
              <li key={key} style={stagger(i)} className="reveal flex gap-4 border-b border-azure-50 py-5 first:pt-0 last:border-b-0">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-azure-25 text-electric">
                  <Check aria-hidden="true" className="size-4" strokeWidth={2.4} />
                </span>
                <span className="pt-1 text-[17px] leading-relaxed text-ink">{t(`values.${key}`)}</span>
              </li>
            ))}
          </ul>
        </section>

      </div>
    </>
  );
}
