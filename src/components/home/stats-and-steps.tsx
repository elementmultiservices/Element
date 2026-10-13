import { getTranslations } from "next-intl/server";
import { CountUp } from "./count-up";
import { stagger } from "@/components/marketing/motion";
import { container, SectionIntro } from "@/components/marketing/section-intro";

const stats = [
  { key: "returns", value: 7000, plus: true },
  { key: "years", value: 7, plus: true },
  { key: "services", value: 14, plus: true },
  { key: "months", value: 12, plus: false },
] as const;

const steps = ["book", "docs", "file"] as const;

export async function Stats() {
  const t = await getTranslations("Home.stats");

  return (
    <section aria-label={t("label")} className={`${container} pb-16 lg:pb-24`}>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-8 border-t border-azure-50 pt-10 lg:grid-cols-4">
        {stats.map(({ key, value, plus }, i) => (
          <div key={key} style={stagger(i)} className="reveal flex flex-col gap-3">
            <dt className="text-sm text-graphite sm:text-[15px]">{t(key)}</dt>
            <dd className="text-5xl leading-none font-semibold tracking-[-0.03em] text-ink lg:text-[64px]">
              <CountUp value={value} />
              {plus ? <span className="text-electric">+</span> : null}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export async function Steps() {
  const t = await getTranslations("Home.steps");

  return (
    <section aria-labelledby="steps-title" className="bg-mist py-16 lg:py-24">
      <div className={`${container} flex flex-col gap-10 lg:gap-12`}>
        <SectionIntro id="steps-title" align="center" eyebrow={t("eyebrow")} title={t("title")} />
        <ol className="grid gap-4 md:grid-cols-3">
          {steps.map((key, i) => (
            <li key={key} style={stagger(i)} className="reveal flex flex-col gap-3 rounded-[28px] border border-azure-50 bg-white p-7 lg:p-8">
              <span aria-hidden="true" className="font-mono text-[44px] leading-none text-azure-200">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-3 text-[22px] font-semibold text-ink">{t(`items.${key}.title`)}</h3>
              <p className="text-base leading-normal text-graphite">{t(`items.${key}.body`)}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
