import { getTranslations } from "next-intl/server";
import { Clock, MapPin, Navigation, Phone } from "lucide-react";
import { SmartLink } from "@/components/marketing/smart-link";
import { Button } from "@/components/ui/button";
import { getSiteContact } from "@/lib/site-settings";
import { MapIllustration } from "@/components/marketing/map-illustration";
import { container, SectionIntro } from "@/components/marketing/section-intro";

export async function Location() {
  const t = await getTranslations();
  const contact = await getSiteContact();

  return (
    <section id="location" aria-labelledby="location-title" className={`${container} grid items-center gap-10 py-16 lg:grid-cols-2 lg:gap-14 lg:py-24`}>
      <div className="flex flex-col gap-8">
        <SectionIntro
          id="location-title"
          eyebrow={t("Home.location.eyebrow")}
          title={
            <>
              {t("Home.location.titleStart")} <span className="text-electric">{t("Home.location.titleAccent")}</span>
            </>
          }
        />
        <address className="reveal flex flex-col gap-4 text-base not-italic text-ink sm:text-[17px]">
          {contact.address ? (
            <p className="flex gap-3">
              <MapPin aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-cobalt" />
              {contact.address}
            </p>
          ) : null}
          {contact.phone ? (
            <p className="flex gap-3">
              <Phone aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-cobalt" />
              <a href={contact.phoneHref} className="hover:text-electric">
                {contact.phone}
              </a>
            </p>
          ) : null}
          <div className="flex gap-3">
            <Clock aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-cobalt" />
            <p className="flex flex-col">
              {contact.hoursRegular.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </p>
          </div>
        </address>
        <div className="reveal flex flex-col gap-3 sm:flex-row">
          <Button asChild variant="brand" size="pill-lg">
            <SmartLink href={contact.mapsHref}>
              <Navigation aria-hidden="true" />
              {t("Home.location.directions")}
            </SmartLink>
          </Button>
          <Button asChild variant="outline-brand" size="pill-lg">
            <SmartLink href={contact.bookingHref}>{t("Nav.book")}</SmartLink>
          </Button>
        </div>
      </div>
      <MapIllustration
        label={t("Home.location.mapPin")}
        href={contact.mapsHref.startsWith("http") ? contact.mapsHref : undefined}
        linkLabel={t("Home.location.directions")}
        className="reveal"
      />
    </section>
  );
}
