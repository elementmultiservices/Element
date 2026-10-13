import { getMessages, getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { stagger } from "@/components/marketing/motion";
import { container, SectionIntro } from "@/components/marketing/section-intro";

const groups = ["taxes", "business", "documents", "protection"] as const;

export async function Services() {
  const t = await getTranslations("Home.services");
  const { groups: copy } = (await getMessages()).Home.services;

  return (
    <section id="services" aria-labelledby="services-title" className={`${container} flex flex-col gap-10 py-16 lg:py-24`}>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <SectionIntro id="services-title" eyebrow={t("eyebrow")} title={t("title")} />
        <Button asChild variant="ink" size="pill" className="reveal group">
          <Link href="/services">
            {t("viewAll")}
            <ArrowRight aria-hidden="true" className="transition-transform group-hover:translate-x-1" />
          </Link>
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {groups.map((key, i) => {
          const items = Object.values(copy[key].items);
          return (
            <section key={key} aria-labelledby={`services-${key}`} style={stagger(i)} className="reveal rounded-[24px] bg-azure-25 p-6">
              <div className="flex items-center gap-3 border-b border-azure-100 pb-4">
                <span className="font-mono text-[13px] text-electric">{String(i + 1).padStart(2, "0")}</span>
                <h3 id={`services-${key}`} className="flex-1 font-mono text-[13px] font-medium tracking-[0.12em] text-ink uppercase">
                  {t(`groups.${key}.title`)}
                </h3>
                <span className="flex size-7 items-center justify-center rounded-full bg-white font-mono text-xs text-navy">
                  {items.length}
                </span>
              </div>
              <ul className="mt-2 divide-y divide-azure-50">
                {items.map((item) => (
                  <li key={item} className="py-2.5 text-base text-ink">
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </section>
  );
}
