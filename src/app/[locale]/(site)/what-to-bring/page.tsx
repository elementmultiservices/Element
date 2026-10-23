import type { Metadata } from "next";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight, CheckCircle2, ClipboardList, LockKeyhole, MapPin, PenLine, Phone, Upload } from "lucide-react";
import { BringTabs } from "@/components/marketing/bring-tabs";
import { delay, stagger } from "@/components/marketing/motion";
import { SmartLink } from "@/components/marketing/smart-link";
import { Button } from "@/components/ui/button";
import { toLocale } from "@/i18n/routing";
import { getSiteContact } from "@/lib/site-settings";
import { pageMetadata } from "@/lib/seo";

type Group = { title: string; items: Record<string, { label: string; sub?: string }> };

export async function generateMetadata({ params }: PageProps<"/[locale]/what-to-bring">): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata({ locale: toLocale(locale), path: "/what-to-bring", page: "whatToBring", descriptionKey: "whatToBring" });
}

export default async function WhatToBringPage({ params }: PageProps<"/[locale]/what-to-bring">) {
  const { locale: rawLocale } = await params;
  const locale = toLocale(rawLocale);
  setRequestLocale(locale);
  const t = await getTranslations("BringPage");
  const tn = await getTranslations("Nav");
  const contact = await getSiteContact();
  const copy = (await getMessages()).BringPage as unknown as { personal: Record<string, Group>; business: Record<string, Group> };
  const startHref = `/api/intake/start?locale=${locale}`;

  const checklist = (groups: Record<string, Group>) => (
    <div className="grid gap-5 md:grid-cols-2">
      {Object.entries(groups).map(([key, group], i) => (
        <section key={key} style={stagger(i)} className="reveal rounded-[28px] border border-azure-50 bg-white p-6 sm:p-7">
          <div className="mb-4 flex items-center gap-3">
            <span className="font-mono text-sm text-electric">{String(i + 1).padStart(2, "0")}</span>
            <h3 className="text-xl font-semibold tracking-[-0.01em] text-ink">{group.title}</h3>
          </div>
          <ul className="flex flex-col gap-3">
            {Object.entries(group.items).map(([itemKey, item]) => (
              <li key={itemKey} className="flex gap-3 text-[15px] leading-relaxed text-graphite">
                <CheckCircle2 aria-hidden="true" className="mt-1 size-4 shrink-0 text-electric" />
                <span>
                  <span className="text-ink">{item.label}</span>
                  {item.sub ? <span className="block text-sm text-graphite">{item.sub}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );

  const steps = [
    { key: "account", icon: LockKeyhole },
    { key: "fill", icon: ClipboardList },
    { key: "sign", icon: PenLine },
    { key: "upload", icon: Upload },
  ] as const;

  return (
    <>
      <section className="px-4 pt-4 sm:px-6">
        <div className="relative mx-auto flex max-w-[1240px] flex-col items-center gap-6 overflow-hidden rounded-[28px] bg-[linear-gradient(180deg,#F0F7FF_0%,#DDEEFD_100%)] px-5 py-14 text-center sm:px-10 lg:rounded-[40px] lg:py-20">
          <span aria-hidden="true" className="motion-float absolute -top-32 -right-24 size-80 rounded-full bg-white/70 blur-3xl" />
          <p style={delay(0)} className="motion-enter relative rounded-full border border-azure-100 bg-white px-4 py-2 text-sm text-navy">
            {t("badge")}
          </p>
          <h1 style={delay(1)} className="motion-enter relative text-[44px] leading-[1] font-semibold tracking-[-0.03em] text-ink sm:text-6xl lg:text-[76px]">
            {t("titleStart")}
            <br />
            <span className="text-electric">{t("titleAccent")}</span>
          </h1>
          <p style={delay(2)} className="motion-enter relative max-w-[640px] text-base leading-relaxed text-graphite sm:text-lg">
            {t("body")}
          </p>
          <div style={delay(3)} className="motion-enter relative flex flex-wrap justify-center gap-3">
            <Button asChild variant="brand" size="pill-lg">
              <a href={startHref}>
                <ClipboardList aria-hidden="true" />
                {t("intake.cta")}
              </a>
            </Button>
            <Button asChild variant="outline-brand" size="pill-lg">
              <SmartLink href={contact.bookingHref}>{tn("book")}</SmartLink>
            </Button>
          </div>
        </div>
      </section>

      <section aria-labelledby="bring-intake" className="px-4 pt-16 sm:px-6 lg:pt-24">
        <div className="reveal relative mx-auto max-w-[1240px] overflow-hidden rounded-[28px] bg-ink px-6 py-12 text-white sm:px-12 lg:rounded-[40px] lg:px-16">
          <span aria-hidden="true" className="motion-float absolute -top-24 -right-16 size-72 rounded-full bg-sky/20 blur-3xl" />
          <div className="relative grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-center">
            <div className="flex flex-col gap-4">
              <p className="font-mono text-xs tracking-[0.08em] text-azure-300 uppercase">{t("intake.eyebrow")}</p>
              <h2 id="bring-intake" className="text-[32px] leading-[1.05] font-semibold tracking-[-0.02em] text-white sm:text-[44px]">
                {t("intake.title")}
              </h2>
              <p className="text-base leading-relaxed text-azure-100">{t("intake.body")}</p>
              <div className="mt-2 flex flex-wrap gap-3">
                <Button asChild size="pill" className="bg-white text-ink hover:bg-azure-25">
                  <a href={startHref}>
                    {t("intake.cta")}
                    <ArrowRight aria-hidden="true" />
                  </a>
                </Button>
              </div>
              <p className="text-sm text-azure-100">{t("intake.note")}</p>
            </div>
            <ol className="grid gap-3 sm:grid-cols-2">
              {steps.map(({ key, icon: Icon }, i) => (
                <li key={key} style={stagger(i)} className="reveal flex flex-col gap-2 rounded-[22px] bg-white/6 p-5 ring-1 ring-white/10">
                  <Icon aria-hidden="true" className="size-5 text-azure-300" />
                  <span className="font-semibold">
                    {i + 1}. {t(`intake.steps.${key}.title`)}
                  </span>
                  <span className="text-sm text-azure-100">{t(`intake.steps.${key}.body`)}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section aria-labelledby="bring-list" className="mx-auto w-full max-w-[1240px] px-4 py-16 sm:px-6 lg:py-24">
        <div className="reveal mx-auto mb-10 flex max-w-[680px] flex-col gap-3 text-center">
          <h2 id="bring-list" className="text-[34px] leading-[1.05] font-semibold tracking-[-0.02em] text-ink sm:text-5xl">
            {t("listTitle")}
          </h2>
          <p className="text-base leading-relaxed text-graphite">{t("listBody")}</p>
        </div>
        <BringTabs
          label={t("listTitle")}
          tabs={[
            { key: "personal", label: t("tabs.personal"), panel: checklist(copy.personal) },
            { key: "business", label: t("tabs.business"), panel: checklist(copy.business) },
          ]}
        />
        <p className="reveal mx-auto mt-10 max-w-[680px] rounded-[22px] bg-azure-25 px-6 py-5 text-center text-[15px] leading-relaxed text-navy">{t("closing")}</p>
      </section>

      <section aria-labelledby="bring-visit" className="px-4 pb-16 sm:px-6 lg:pb-24">
        <div className="reveal relative mx-auto flex max-w-[1240px] flex-col gap-6 overflow-hidden rounded-[28px] bg-[linear-gradient(150deg,#050D29_0%,#13295A_60%,#2B56B3_100%)] px-6 py-14 text-white sm:px-12 lg:flex-row lg:items-center lg:justify-between lg:rounded-[40px] lg:px-16">
          <div className="flex max-w-[560px] flex-col gap-3">
            <h2 id="bring-visit" className="text-[32px] leading-[1.05] font-semibold tracking-[-0.02em] text-white sm:text-[44px]">
              {t("visit.title")}
            </h2>
            <p className="text-base leading-relaxed text-azure-100">{t("visit.body")}</p>
            {contact.address ? (
              <p className="flex items-center gap-2 text-sm text-azure-100">
                <MapPin aria-hidden="true" className="size-4 shrink-0" />
                {contact.address}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="pill" className="bg-white text-ink hover:bg-azure-25">
              <SmartLink href={contact.bookingHref}>{tn("book")}</SmartLink>
            </Button>
            <Button asChild size="pill" variant="ink" className="ring-1 ring-white/30">
              <SmartLink href={contact.phoneHref}>
                <Phone aria-hidden="true" />
                {tn("call")}
              </SmartLink>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
