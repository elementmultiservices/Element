import { getTranslations } from "next-intl/server";
import { Quote } from "lucide-react";
import { cn } from "@/lib/utils";
import { stagger } from "@/components/marketing/motion";
import { container, SectionIntro } from "@/components/marketing/section-intro";

// "a" and "c" are the tall cards in the first and third columns on desktop.
const items = ["a", "b", "c", "d"] as const;
const featured = new Set<string>(["a", "c"]);

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

export async function Testimonials() {
  const t = await getTranslations("Home.testimonials");

  return (
    <section aria-labelledby="testimonials-title" className="bg-mist py-16 lg:py-24">
      <div className={`${container} flex flex-col gap-10`}>
        <SectionIntro id="testimonials-title" eyebrow={t("eyebrow")} title={t("title")} body={t("body")} />
        <ul className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:-mx-6 sm:px-6 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 md:pb-0 lg:grid-cols-3">
          {items.map((key, i) => {
            const name = t(`items.${key}.name`);
            return (
              <li
                key={key}
                style={stagger(i)}
                className={cn(
                  "reveal flex w-[86%] shrink-0 snap-start flex-col gap-6 rounded-[28px] border border-azure-50 bg-white p-7 md:w-auto",
                  featured.has(key) && "lg:row-span-2 lg:p-9",
                )}
              >
                <Quote aria-hidden="true" className="size-7 fill-electric text-electric" />
                <blockquote className={cn("text-[17px] leading-normal text-ink", featured.has(key) && "lg:text-[22px] lg:leading-snug")}>
                  {t(`items.${key}.quote`)}
                </blockquote>
                <p className="mt-auto flex items-center gap-3">
                  <span aria-hidden="true" className="flex size-11 items-center justify-center rounded-full bg-azure-50 font-mono text-[13px] text-navy">
                    {initials(name)}
                  </span>
                  <span className="flex flex-col">
                    <span className="text-[15px] font-semibold text-ink">{name}</span>
                    <span className="text-sm text-graphite">{t(`items.${key}.place`)}</span>
                  </span>
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
