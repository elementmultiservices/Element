import { getTranslations } from "next-intl/server";
import { ArrowUpRight, MessageCircle } from "lucide-react";
import { SmartLink } from "@/components/marketing/smart-link";
import { Button } from "@/components/ui/button";
import { getSiteContact } from "@/lib/site-settings";

export async function FinalCta() {
  const t = await getTranslations("Home");
  const contact = await getSiteContact();

  return (
    <section aria-labelledby="cta-title" className="px-4 pb-16 sm:px-6 lg:pb-24">
      <div className="reveal relative mx-auto flex max-w-[1240px] flex-col items-center gap-6 overflow-hidden rounded-[28px] bg-[linear-gradient(165deg,#F0F7FF_0%,#C5E3FB_55%,#79BCF9_100%)] px-6 py-20 text-center sm:py-24 lg:rounded-[40px]">
        <h2 id="cta-title" className="max-w-[760px] text-[40px] leading-[1.02] font-semibold tracking-[-0.03em] text-ink sm:text-6xl lg:text-[72px]">
          {t("finalCta.titleStart")} <span className="text-electric">{t("finalCta.titleAccent")}</span>
        </h2>
        <p className="max-w-[520px] text-base leading-relaxed text-navy sm:text-lg">{t("finalCta.body")}</p>
        <div className="flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
          <Button asChild variant="brand" size="pill-lg">
            <SmartLink href={contact.bookingHref}>
              {t("hero.book")}
              <ArrowUpRight aria-hidden="true" />
            </SmartLink>
          </Button>
          <Button asChild variant="ink" size="pill-lg">
            <SmartLink href={contact.whatsappHref}>
              <MessageCircle aria-hidden="true" />
              {t("hero.whatsapp")}
            </SmartLink>
          </Button>
        </div>
        <span aria-hidden="true" className="motion-float absolute top-6 left-6 hidden -rotate-6 rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-white shadow-[0_12px_18px_rgba(5,13,41,0.25)] md:block lg:top-12 lg:left-14">
          {t("finalCta.badgeFiled")}
        </span>
        <span aria-hidden="true" className="motion-float absolute right-6 bottom-6 hidden rotate-6 [animation-delay:-3s] rounded-full bg-white px-4 py-2.5 text-sm font-medium text-ink shadow-[0_12px_18px_rgba(5,13,41,0.15)] md:block lg:right-14 lg:bottom-12">
          {t("finalCta.badgeItin")}
        </span>
      </div>
    </section>
  );
}
