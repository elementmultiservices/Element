import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";
import { stagger } from "@/components/marketing/motion";
import { container, SectionIntro } from "@/components/marketing/section-intro";

const bars = [
  { height: "30%", color: "bg-navy" },
  { height: "45%", color: "bg-royal" },
  { height: "60%", color: "bg-electric" },
  { height: "100%", color: "bg-sky" },
  { height: "70%", color: "bg-azure-300" },
  { height: "50%", color: "bg-azure-200" },
  { height: "40%", color: "bg-azure-100" },
  { height: "35%", color: "bg-azure-50" },
];

const card = "flex w-[86%] shrink-0 snap-start flex-col gap-5 rounded-[28px] p-7 sm:w-[60%] lg:w-auto lg:min-h-[320px] lg:rounded-[32px] lg:p-8";
const eyebrow = "font-mono text-[13px] tracking-[0.1em]";
const title = "text-[26px] leading-[1.1] font-semibold lg:text-[30px]";
const body = "text-base leading-normal lg:text-[17px]";

export async function WhyElement() {
  const t = await getTranslations("Home.why");

  return (
    <section aria-labelledby="why-title" className={`${container} flex flex-col gap-10 py-16 lg:py-[72px]`}>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <SectionIntro id="why-title" eyebrow={t("eyebrow")} title={t("title")} className="max-w-[620px]" />
        <p className="reveal max-w-[420px] text-base leading-relaxed text-graphite sm:text-lg">{t("body")}</p>
      </div>
      <ul className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0 lg:pb-0">
        <li style={stagger(0)} className={cn(card, "reveal bg-azure-25")}>
          <p className={cn(eyebrow, "text-electric")}>{t("estimate.eyebrow")}</p>
          <h3 className={cn(title, "text-ink")}>{t("estimate.title")}</h3>
          <p className={cn(body, "text-graphite")}>{t("estimate.body")}</p>
          <p className="mt-auto flex items-center gap-2.5 rounded-2xl bg-white px-4 py-3.5">
            <span className="flex-1 text-[15px] text-ink">{t("estimate.priceLabel")}</span>
            <span className="font-mono text-base font-medium text-ink">{t("estimate.price")}</span>
          </p>
        </li>
        <li style={stagger(1)} className={cn(card, "reveal bg-ink")}>
          <p className={cn(eyebrow, "text-azure-300")}>{t("yearRound.eyebrow")}</p>
          <h3 className={cn(title, "text-white")}>{t("yearRound.title")}</h3>
          <p className={cn(body, "text-azure-100")}>{t("yearRound.body")}</p>
          <div aria-hidden="true" className="reveal-grow-y mt-auto flex h-16 items-end gap-1.5">
            {bars.map((bar) => (
              <span key={bar.color} className={cn("flex-1 rounded-md", bar.color)} style={{ height: bar.height }} />
            ))}
          </div>
        </li>
        <li style={stagger(2)} className={cn(card, "reveal bg-azure-25")}>
          <p className={cn(eyebrow, "text-electric")}>{t("language.eyebrow")}</p>
          <h3 className={cn(title, "text-ink")}>{t("language.title")}</h3>
          <p className={cn(body, "text-graphite")}>{t("language.body")}</p>
          <p aria-hidden="true" className="mt-auto flex gap-2 text-sm font-semibold">
            <span lang="es" className="rounded-full bg-electric px-4 py-2.5 text-white">Español</span>
            <span lang="en" className="rounded-full bg-white px-4 py-2.5 text-ink">English</span>
          </p>
        </li>
      </ul>
    </section>
  );
}
