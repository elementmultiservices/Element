import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Bus, Car, Mail, MapPin, Navigation, Phone, TrainFront } from "lucide-react";
import { VisitQuestionForm } from "@/components/location/visit-question-form";
import { MapIllustration } from "@/components/marketing/map-illustration";
import { delay, stagger } from "@/components/marketing/motion";
import { container } from "@/components/marketing/section-intro";
import { SmartLink } from "@/components/marketing/smart-link";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { getSiteContact } from "@/lib/site-settings";
import { issueFormToken } from "@/lib/security/form-token";
import { pageMetadata } from "@/lib/seo";
import { cn } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/[locale]/location">): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata({ locale: toLocale(locale), path: "/location", page: "location", descriptionKey: "location" });
}

export default async function LocationPage({ params }: PageProps<"/[locale]/location">) {
  const { locale } = await params;
  setRequestLocale(toLocale(locale));
  const t = await getTranslations("LocationPage");
  const contact = await getSiteContact();
  const tg = await getTranslations();
  const formToken = await issueFormToken("contact");

  const rows = [
    { key: "address", icon: MapPin, value: contact.address },
    { key: "phone", icon: Phone, value: contact.phone },
    { key: "email", icon: Mail, value: contact.email },
  ].filter((row) => row.value) as { key: "address" | "phone" | "email"; icon: typeof MapPin; value: string }[];
  const getting = [
    { key: "train", icon: TrainFront },
    { key: "bus", icon: Bus },
    { key: "car", icon: Car },
    { key: "landmark", icon: MapPin },
  ] as const;
  const steps = ["welcome", "review", "price", "leave"] as const;

  return (
    <>
      <section aria-labelledby="location-title" className={`${container} flex flex-col gap-10 pt-10 pb-16 lg:pt-14 lg:pb-24`}>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex flex-col gap-3">
            <p style={delay(0)} className="motion-enter text-[15px] text-graphite">
              {t("eyebrow")}
            </p>
            <h1
              id="location-title"
              style={delay(1)}
              className="motion-enter max-w-[620px] text-[44px] leading-[1] font-semibold tracking-[-0.03em] text-ink sm:text-6xl lg:text-[76px]"
            >
              {t("titleStart")} <span className="text-electric">{t("titleAccent")}</span>
            </h1>
          </div>
          <p style={delay(2)} className="motion-enter max-w-[400px] text-base leading-relaxed text-graphite sm:text-lg">
            {t("body")}
          </p>
        </div>

        <div
          style={delay(3)}
          className="motion-enter-scale grid overflow-hidden rounded-[28px] border border-azure-50 bg-white shadow-[0_30px_60px_rgba(5,13,41,0.06)] lg:grid-cols-[1.1fr_1fr] lg:rounded-[36px]"
        >
          <div className="flex flex-col gap-6 p-6 sm:p-9">
            <p className="flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded-full bg-ink px-3 py-1.5 text-white">{t("office")}</span>
              <span className="rounded-full bg-azure-25 px-3 py-1.5 text-electric">{t("openAllYear")}</span>
            </p>
            <address className="flex flex-col gap-4 not-italic">
              {rows.map(({ key, icon: Icon, value }) => (
                <p key={key} className="flex items-center gap-3.5">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-azure-25 text-cobalt">
                    <Icon aria-hidden="true" className="size-[18px]" />
                  </span>
                  <span className="flex flex-col">
                    <span className="text-xs text-graphite">{t(key)}</span>
                    <span className="text-base font-medium text-ink">{value}</span>
                  </span>
                </p>
              ))}
            </address>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[20px] border border-azure-50 bg-azure-25 p-5">
                <p className="font-mono text-[11px] tracking-[0.1em] text-electric">{t("regular.label")}</p>
                <ul className="mt-3 flex flex-col gap-1 text-sm text-ink">
                  {contact.hoursRegular.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-[20px] bg-ink p-5 text-white">
                <p className="font-mono text-[11px] tracking-[0.1em] text-azure-300">{t("season.label")}</p>
                <ul className="mt-3 flex flex-col gap-1 text-sm">
                  {contact.hoursSeason.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="brand" size="pill">
                <SmartLink href={contact.mapsHref}>
                  <Navigation aria-hidden="true" />
                  {t("directions")}
                </SmartLink>
              </Button>
              <Button asChild variant="ink" size="pill">
                <SmartLink href={contact.bookingHref}>{tg("Nav.book")}</SmartLink>
              </Button>
              <Button asChild variant="outline-brand" size="pill">
                <SmartLink href={contact.phoneHref}>
                  <Phone aria-hidden="true" />
                  {t("call")}
                </SmartLink>
              </Button>
            </div>
          </div>
          <MapIllustration
            label={tg("Home.location.mapPin")}
            badge={t("station")}
            logoPin
            href={contact.mapsHref.startsWith("http") ? contact.mapsHref : undefined}
            linkLabel={t("directions")}
            className="h-[320px] rounded-none sm:h-[400px] lg:h-full lg:rounded-none"
          />
        </div>
      </section>

      <section aria-labelledby="getting-title" className="border-y border-azure-50 bg-mist py-16 lg:py-24">
        <div className={`${container} flex flex-col gap-10`}>
          <div className="reveal flex flex-col gap-3">
            <p className="text-[15px] text-graphite">{t("getting.eyebrow")}</p>
            <h2 id="getting-title" className="text-[34px] leading-[1.05] font-semibold tracking-[-0.02em] text-ink sm:text-5xl">
              {t("getting.title")}
            </h2>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {getting.map(({ key, icon: Icon }, i) => {
              const accent = key === "landmark";
              return (
                <li
                  key={key}
                  style={stagger(i)}
                  className={cn(
                    "reveal flex flex-col gap-4 rounded-[24px] p-6 transition-transform duration-300 hover:-translate-y-1",
                    accent ? "bg-electric text-white shadow-[0_20px_40px_rgba(27,131,244,0.25)]" : "border border-azure-50 bg-white",
                  )}
                >
                  <span className={cn("flex size-11 items-center justify-center rounded-full", accent ? "bg-white text-electric" : "bg-ink text-white")}>
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <h3 className={cn("text-lg font-semibold", accent ? "text-white" : "text-ink")}>{t(`getting.items.${key}.title`)}</h3>
                  <p className={cn("text-sm leading-relaxed", accent ? "text-azure-50" : "text-graphite")}>{t(`getting.items.${key}.body`)}</p>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section aria-labelledby="expect-title" className={`${container} grid gap-10 py-16 lg:grid-cols-2 lg:gap-14 lg:py-24`}>
        <div className="reveal flex flex-col gap-4">
          <p className="text-[15px] text-graphite">{t("expect.eyebrow")}</p>
          <h2 id="expect-title" className="max-w-[520px] text-[34px] leading-[1.05] font-semibold tracking-[-0.02em] text-ink sm:text-5xl">
            {t("expect.title")}
          </h2>
          <p className="max-w-[440px] text-base leading-relaxed text-graphite">{t("expect.body")}</p>
        </div>
        <ol className="flex flex-col">
          {steps.map((key, i) => (
            <li key={key} style={stagger(i)} className="reveal flex gap-5 border-b border-azure-50 py-5 first:pt-0 last:border-b-0">
              <span className="pt-1 font-mono text-xs text-electric">{String(i + 1).padStart(2, "0")}</span>
              <div className="flex flex-col gap-1">
                <h3 className="text-lg font-semibold text-ink">{t(`expect.steps.${key}.title`)}</h3>
                <p className="text-[15px] text-graphite">{t(`expect.steps.${key}.body`)}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="px-4 pb-16 sm:px-6 lg:pb-24">
        <div className="mx-auto grid max-w-[1240px] gap-4 lg:grid-cols-2">
          <div className="reveal relative flex flex-col items-start gap-5 overflow-hidden rounded-[28px] bg-[linear-gradient(160deg,#050D29_0%,#13295A_60%,#2B56B3_100%)] p-8 text-white sm:p-10 lg:rounded-[36px]">
            <span aria-hidden="true" className="motion-float absolute -right-20 -bottom-24 size-72 rounded-full bg-sky/25 blur-3xl" />
            <p className="relative rounded-full bg-white/10 px-3.5 py-1.5 text-sm text-azure-100">{t("remote.badge")}</p>
            <h2 className="relative text-[32px] leading-[1.05] font-semibold tracking-[-0.02em] text-white sm:text-[42px]">{t("remote.title")}</h2>
            <p className="relative max-w-[460px] text-base leading-relaxed text-azure-100">{t("remote.body")}</p>
            <Button asChild size="pill-lg" className="relative mt-auto bg-white text-ink hover:bg-azure-25">
              <Link href="/sign-up">{t("remote.cta")}</Link>
            </Button>
          </div>
          <div id="contact-form" style={stagger(1)} className="reveal flex scroll-mt-28 flex-col gap-6 rounded-[28px] border border-azure-50 bg-white p-6 sm:p-10 lg:rounded-[36px]">
            <h2 className="text-2xl leading-tight font-semibold text-ink sm:text-[28px]">{t("form.title")}</h2>
            <VisitQuestionForm formToken={formToken} />
            <p className="text-xs leading-relaxed text-graphite">{t("form.note")}</p>
          </div>
        </div>
      </section>
    </>
  );
}
