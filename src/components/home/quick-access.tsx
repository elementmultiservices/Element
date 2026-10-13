import { getTranslations } from "next-intl/server";
import { ArrowRight, Briefcase, Building, Calculator, ChevronRight, IdCard, Languages, UserRound, Wallet } from "lucide-react";
import { SmartLink } from "@/components/marketing/smart-link";
import { Link } from "@/i18n/navigation";
import { getSiteContact } from "@/lib/site-settings";
import { stagger } from "@/components/marketing/motion";
import { container, SectionIntro } from "@/components/marketing/section-intro";

const items = [
  { key: "personal", icon: UserRound },
  { key: "business", icon: Briefcase },
  { key: "selfEmployed", icon: Wallet },
  { key: "itin", icon: IdCard },
  { key: "company", icon: Building },
  { key: "payroll", icon: Calculator },
  { key: "documents", icon: Languages },
] as const;

export async function QuickAccess() {
  const t = await getTranslations("Home.quick");
  const contact = await getSiteContact();

  return (
    <section aria-labelledby="quick-title" className={`${container} flex flex-col gap-10 pt-16 pb-10 lg:gap-12 lg:pt-28`}>
      <SectionIntro id="quick-title" align="center" eyebrow={t("eyebrow")} title={t("title")} body={t("body")} />
      <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {items.map(({ key, icon: Icon }, i) => (
          <li key={key} style={stagger(i % 4)} className="reveal">
            <SmartLink
              href={contact.bookingHref}
              className="group flex h-full flex-col gap-3 rounded-[22px] border border-azure-50 bg-white p-4 transition-[border-color,box-shadow,translate] duration-300 hover:-translate-y-1 hover:border-azure-100 hover:shadow-[0_18px_40px_rgba(5,13,41,0.08)] sm:gap-[18px] sm:rounded-[28px] sm:p-[26px] lg:min-h-[230px]"
            >
              <span className="flex items-start justify-between">
                <span className="flex size-11 items-center justify-center rounded-full bg-ink text-white sm:size-[54px]">
                  <Icon aria-hidden="true" className="size-5 sm:size-6" />
                </span>
                <span className="hidden size-10 items-center justify-center rounded-full bg-azure-25 text-ink transition-[background-color,color,translate] duration-300 group-hover:translate-x-0.5 group-hover:bg-electric group-hover:text-white sm:flex">
                  <ChevronRight aria-hidden="true" className="size-4" />
                </span>
              </span>
              <span className="text-[17px] leading-tight font-semibold text-ink sm:text-[22px]">{t(`items.${key}.title`)}</span>
              <span className="text-sm leading-snug text-graphite sm:text-base sm:leading-[1.45]">{t(`items.${key}.body`)}</span>
            </SmartLink>
          </li>
        ))}
        <li style={stagger(3)} className="reveal">
          <Link
            href="/services"
            className="group flex h-full flex-col justify-between gap-4 rounded-[22px] bg-electric p-4 text-white transition-[background-color,translate] duration-300 hover:-translate-y-1 hover:bg-electric-hover sm:rounded-[28px] sm:p-[26px] lg:min-h-[230px]"
          >
            <span className="font-mono text-[13px] tracking-[0.1em] text-azure-50">{t("all.eyebrow")}</span>
            <span className="text-xl leading-[1.15] font-semibold sm:text-[26px]">{t("all.title")}</span>
            <span className="flex items-center gap-2 text-sm font-semibold sm:text-base">
              <span className="flex-1">{t("all.body")}</span>
              <ArrowRight aria-hidden="true" className="size-4 shrink-0 transition-transform group-hover:translate-x-1" />
            </span>
          </Link>
        </li>
      </ul>
    </section>
  );
}
