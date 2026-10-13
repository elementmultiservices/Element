import { getTranslations } from "next-intl/server";
import { ArrowRight, MessageCircle } from "lucide-react";
import { Accordion } from "@/components/marketing/accordion";
import { container, SectionIntro } from "@/components/marketing/section-intro";
import { SmartLink } from "@/components/marketing/smart-link";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getSiteContact } from "@/lib/site-settings";

const items = ["noSsn", "pastYears", "cost", "secure", "afterApril"] as const;

export async function Faq() {
  const t = await getTranslations("Home");
  const contact = await getSiteContact();

  return (
    <section id="faq" aria-labelledby="faq-title" className={`${container} grid gap-10 py-16 lg:grid-cols-[1fr_1.4fr] lg:gap-14 lg:py-24`}>
      <div className="flex flex-col items-start gap-8">
        <SectionIntro id="faq-title" eyebrow={t("faq.eyebrow")} title={t("faq.title")} body={t("faq.body")} />
        <div className="reveal flex flex-col items-start gap-4">
          <Button asChild variant="ink" size="pill-lg">
            <SmartLink href={contact.whatsappHref}>
              <MessageCircle aria-hidden="true" />
              {t("hero.whatsapp")}
            </SmartLink>
          </Button>
          <Link href="/faq" className="group inline-flex items-center gap-2 rounded-sm text-[15px] font-semibold text-electric">
            {t("faq.viewAll")}
            <ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
      <Accordion className="reveal" items={items.map((key) => ({ q: t(`faq.items.${key}.q`), a: <p>{t(`faq.items.${key}.a`)}</p> }))} />
    </section>
  );
}
