"use client";

import { useDeferredValue, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  Calculator,
  CalendarClock,
  FilePen,
  Gauge,
  HeartHandshake,
  IdCard,
  Landmark,
  Languages,
  ReceiptText,
  Search,
  Stamp,
  UserRound,
  UsersRound,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { delay, stagger } from "@/components/marketing/motion";
import { SmartLink } from "@/components/marketing/smart-link";
import { cn } from "@/lib/utils";

const icons: Record<string, LucideIcon> = {
  personal: UserRound,
  businessReturn: BriefcaseBusiness,
  selfEmployed: Wallet,
  estimated: CalendarClock,
  salesTax: ReceiptText,
  itin: IdCard,
  registration: Landmark,
  payroll: UsersRound,
  bookkeeping: Calculator,
  translations: Languages,
  immigration: FilePen,
  notary: Stamp,
  lifeInsurance: HeartHandshake,
  credit: Gauge,
};

export type ServiceItem = {
  key: string;
  tag: string;
  title: string;
  lead: string;
  body: string;
  note?: string;
  cta: string;
  keywords: string;
  highlight?: boolean;
};

export type ServiceGroup = { key: string; eyebrow: string; title: string; tab: string; body: string; items: ServiceItem[] };

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/**
 * Hero search + category filter + the service catalogue. Filtering happens on
 * the client; every card stays in the server-rendered HTML for search engines.
 */
export function ServicesExplorer({
  intro,
  groups,
  bookingHref,
  taxesExtras,
}: {
  intro: ReactNode;
  groups: ServiceGroup[];
  bookingHref: string;
  /** Extra blocks shown under the tax cards when nothing is being searched. */
  taxesExtras?: ReactNode;
}) {
  const t = useTranslations("ServicesPage");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const deferred = useDeferredValue(query);
  const terms = normalize(deferred).split(/\s+/).filter(Boolean);
  const searching = terms.length > 0;

  const visible = groups
    .filter((g) => !category || g.key === category)
    .map((g) => ({
      ...g,
      items: g.items.filter((item) => {
        if (!searching) return true;
        const haystack = normalize(`${item.title} ${item.tag} ${item.lead} ${item.body} ${item.keywords} ${g.tab}`);
        return terms.every((term) => haystack.includes(term));
      }),
    }))
    .filter((g) => g.items.length > 0);
  const count = visible.reduce((n, g) => n + g.items.length, 0);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    document.getElementById("services-results")?.scrollIntoView({ block: "start" });
  }

  return (
    <>
      <section className="px-4 pt-4 sm:px-6">
        <div className="relative mx-auto flex max-w-[1240px] flex-col items-center gap-8 overflow-hidden rounded-[28px] bg-[linear-gradient(180deg,#F0F7FF_0%,#DDEEFD_100%)] px-5 py-14 text-center sm:px-10 lg:rounded-[40px] lg:py-20">
          <span aria-hidden="true" className="motion-float absolute -top-32 -left-24 size-80 rounded-full bg-white/70 blur-3xl" />
          <span aria-hidden="true" className="motion-float absolute -right-24 -bottom-32 size-80 rounded-full bg-azure-200/50 blur-3xl [animation-delay:-3s]" />
          <div className="relative flex flex-col items-center gap-5">{intro}</div>
          <form
            role="search"
            onSubmit={onSubmit}
            style={delay(3)}
            className="motion-enter relative flex w-full max-w-[600px] items-center gap-2 rounded-full border border-azure-100 bg-white p-1.5 pl-5 shadow-[0_18px_40px_rgba(5,13,41,0.08)] focus-within:border-electric"
          >
            <Search aria-hidden="true" className="size-5 shrink-0 text-cobalt" />
            <label htmlFor="services-search" className="sr-only">
              {t("search.label")}
            </label>
            <input
              id="services-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("search.placeholder")}
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent py-2 text-[15px] text-ink outline-none placeholder:text-graphite/70 [&::-webkit-search-cancel-button]:hidden"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label={t("search.clear")}
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-graphite hover:bg-azure-25"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            ) : null}
            <button
              type="submit"
              className="min-h-10 shrink-0 rounded-full bg-electric px-5 text-sm font-semibold text-white transition-colors hover:bg-electric-hover"
            >
              {t("search.submit")}
            </button>
          </form>
          <div
            role="group"
            aria-label={t("filters.label")}
            style={delay(4)}
            className="motion-enter relative flex flex-wrap justify-center gap-2"
          >
            {[{ key: null, tab: t("filters.all") }, ...groups.map((g) => ({ key: g.key, tab: g.tab }))].map(({ key, tab }) => {
              const active = category === key;
              return (
                <button
                  key={tab}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setCategory(key)}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-medium transition-colors duration-300",
                    active ? "bg-ink text-white" : "bg-white text-ink hover:bg-azure-50",
                  )}
                >
                  {tab}
                </button>
              );
            })}
          </div>
          <p aria-live="polite" className="sr-only">
            {searching || category ? t("search.results", { count }) : ""}
          </p>
        </div>
      </section>

      <div id="services-results" className="scroll-mt-28">
        {visible.length === 0 ? (
          <p className="mx-auto max-w-[560px] px-4 py-24 text-center text-lg text-graphite">{t("search.empty", { query: query.trim() })}</p>
        ) : (
          visible.map((group) => (
            <section
              key={group.key}
              id={group.key}
              aria-labelledby={`group-${group.key}`}
              className="mx-auto flex w-full max-w-[1240px] scroll-mt-28 flex-col gap-8 px-4 pt-16 sm:px-6 lg:pt-24"
            >
              <div className="reveal flex flex-wrap items-end justify-between gap-x-10 gap-y-3">
                <div className="flex flex-col gap-3">
                  <p className="font-mono text-xs tracking-[0.12em] text-electric">{group.eyebrow}</p>
                  <h2 id={`group-${group.key}`} className="text-[32px] leading-[1.05] font-semibold tracking-[-0.02em] text-ink sm:text-[44px]">
                    {group.title}
                  </h2>
                </div>
                <p className="max-w-[400px] text-base leading-relaxed text-graphite">{group.body}</p>
              </div>
              <ul
                className={cn(
                  "grid gap-4 sm:grid-cols-2",
                  group.key === "protection" ? "lg:grid-cols-2" : "lg:grid-cols-3",
                )}
              >
                {group.items.map((item, i) => (
                  <li key={item.key} id={item.key === "itin" ? "itin" : undefined} style={stagger(i % 3)} className="reveal scroll-mt-28">
                    <ServiceCard item={item} href={bookingHref} wide={group.key === "protection"} />
                  </li>
                ))}
              </ul>
              {group.key === "taxes" && !searching ? taxesExtras : null}
            </section>
          ))
        )}
      </div>
    </>
  );
}

function ServiceCard({ item, href, wide }: { item: ServiceItem; href: string; wide: boolean }) {
  const Icon = icons[item.key] ?? UserRound;
  const hi = item.highlight;
  return (
    <article
      className={cn(
        "group flex h-full flex-col gap-4 rounded-[28px] p-6 transition-[translate,box-shadow,border-color] duration-300 hover:-translate-y-1 lg:p-7",
        hi
          ? "bg-electric text-white shadow-[0_24px_48px_rgba(27,131,244,0.25)]"
          : wide
            ? "bg-azure-25 hover:shadow-[0_18px_40px_rgba(5,13,41,0.08)]"
            : "border border-azure-50 bg-white hover:border-azure-100 hover:shadow-[0_18px_40px_rgba(5,13,41,0.08)]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={cn("flex size-12 items-center justify-center rounded-full", hi ? "bg-white/15 text-white" : "bg-ink text-white")}>
          <Icon aria-hidden="true" className="size-5" />
        </span>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 font-mono text-[11px] tracking-[0.06em]",
            hi ? "bg-white/15 text-white" : "bg-azure-25 text-cobalt",
            wide && !hi && "bg-white",
          )}
        >
          {item.tag}
        </span>
      </div>
      <h3 className={cn("text-xl font-semibold", hi ? "text-white" : "text-ink")}>{item.title}</h3>
      <p className={cn("text-[15px] leading-snug font-medium", hi ? "text-white" : "text-navy")}>{item.lead}</p>
      <p className={cn("text-sm leading-relaxed", hi ? "text-azure-50" : "text-graphite")}>{item.body}</p>
      {item.note ? (
        <p className="rounded-xl bg-azure-25 px-3.5 py-2.5 text-xs leading-relaxed text-graphite">{item.note}</p>
      ) : null}
      <SmartLink
        href={href}
        className={cn(
          "mt-auto inline-flex items-center gap-2 pt-2 text-sm font-semibold",
          hi ? "text-white" : "text-ink hover:text-electric",
        )}
      >
        {item.cta}
        <ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-1" />
      </SmartLink>
    </article>
  );
}
