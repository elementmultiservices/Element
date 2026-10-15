import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowUpRight } from "lucide-react";
import { z } from "zod";
import { CtaPanel } from "@/components/marketing/cta-panel";
import { delay, stagger } from "@/components/marketing/motion";
import { SmartLink } from "@/components/marketing/smart-link";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/updates/pagination";
import { UpdateCard } from "@/components/updates/update-card";
import { Link } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { IRS_CATEGORIES, IRS_CATEGORY_KEYS, irsNewsroomUrl, loadIrsUpdates, UPDATES_PAGE_SIZE } from "@/lib/irs/newsroom";
import { getSiteContact } from "@/lib/site-settings";
import { pageMetadata } from "@/lib/seo";
import { cn } from "@/lib/utils";

const paramsSchema = z.object({
  category: z.enum(IRS_CATEGORY_KEYS).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(1000).default(1).catch(1),
});

export async function generateMetadata({ params }: PageProps<"/[locale]/updates">): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata({ locale: toLocale(locale), path: "/updates", page: "updates", descriptionKey: "updates" });
}

export default async function UpdatesPage({ params, searchParams }: PageProps<"/[locale]/updates">) {
  const { locale: rawLocale } = await params;
  const locale = toLocale(rawLocale);
  setRequestLocale(locale);
  const { category, page: requestedPage } = paramsSchema.parse(await searchParams);
  const [t, tn, contact, all] = await Promise.all([getTranslations("Updates"), getTranslations("Nav"), getSiteContact(), loadIrsUpdates(locale)]);
  const newsroomUrl = irsNewsroomUrl(locale);

  const filtered = (all ?? []).filter((u) => !category || u.category === category);
  const pageCount = Math.max(1, Math.ceil(filtered.length / UPDATES_PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);
  const items = filtered.slice((page - 1) * UPDATES_PAGE_SIZE, page * UPDATES_PAGE_SIZE);

  const query = (overrides: { category?: string; page?: number }) => {
    const q: Record<string, string> = {};
    const c = "category" in overrides ? overrides.category : category;
    const p = overrides.page ?? 1;
    if (c) q.category = c;
    if (p > 1) q.page = String(p);
    return q;
  };
  const pill = (active: boolean) =>
    cn("rounded-full px-4 py-2 text-sm font-medium transition-colors duration-300", active ? "bg-ink text-white" : "bg-azure-25 text-ink hover:bg-azure-50");

  return (
    <>
      <section className="mx-auto flex max-w-[1240px] flex-col items-center gap-5 px-4 pt-12 pb-12 text-center sm:px-6 lg:pt-16">
        <p style={delay(0)} className="motion-enter font-mono text-xs tracking-[0.2em] text-electric">
          {t("eyebrow")}
        </p>
        <h1 style={delay(1)} className="motion-enter text-[44px] leading-[1] font-semibold tracking-[-0.03em] text-ink sm:text-6xl lg:text-[76px]">
          {t("heroTitleStart")}
          <br />
          <span className="text-electric">{t("heroTitleAccent")}</span>
        </h1>
        <p style={delay(2)} className="motion-enter max-w-[560px] text-base leading-relaxed text-graphite sm:text-lg">
          {t("heroBody")}
        </p>
        {all ? (
          <nav style={delay(3)} aria-label={t("categoriesLabel")} className="motion-enter mt-2">
            <ul className="flex flex-wrap justify-center gap-2">
              <li>
                <Link href={{ pathname: "/updates", query: query({ category: undefined }) }} aria-current={!category ? "page" : undefined} className={pill(!category)}>
                  {t("allCategories")}
                </Link>
              </li>
              {IRS_CATEGORY_KEYS.map((key) => (
                <li key={key}>
                  <Link
                    href={{ pathname: "/updates", query: query({ category: key }) }}
                    aria-current={category === key ? "page" : undefined}
                    className={pill(category === key)}
                  >
                    {IRS_CATEGORIES[key][locale]}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </section>

      {!all ? (
        <div className="mx-auto flex max-w-[560px] flex-col items-center gap-5 rounded-[24px] border border-dashed border-azure-100 bg-mist px-6 py-14 text-center text-graphite">
          <p>{t("unavailable")}</p>
          <a
            href={newsroomUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-azure-100 bg-white px-5 font-semibold text-ink hover:bg-azure-25"
          >
            {t("visitNewsroom")}
            <ArrowUpRight aria-hidden="true" className="size-4" />
            <span className="sr-only"> {t("opensInNewTab")}</span>
          </a>
        </div>
      ) : items.length === 0 ? (
        <p className="mx-auto max-w-[560px] rounded-[24px] border border-dashed border-azure-100 bg-mist px-6 py-14 text-center text-graphite">{t("empty")}</p>
      ) : (
        <section aria-labelledby="latest-title" className="mx-auto flex max-w-[1240px] flex-col gap-8 px-4 sm:px-6">
          <div className="reveal flex flex-wrap items-end justify-between gap-3">
            <h2 id="latest-title" className="text-[32px] leading-[1.05] font-semibold tracking-[-0.02em] text-ink sm:text-[44px]">
              {t("latest")}
            </h2>
            <a href={newsroomUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-graphite hover:text-electric">
              {t("latestNote")}
              <ArrowUpRight aria-hidden="true" className="size-3.5" />
              <span className="sr-only"> {t("opensInNewTab")}</span>
            </a>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((update, i) => (
              <li key={update.url} style={stagger(i % 3)} className="reveal">
                <UpdateCard update={update} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <Pagination page={page} pageCount={pageCount} href={(p) => ({ pathname: "/updates", query: query({ page: p }) })} />

      <p className="mx-auto mt-12 max-w-[640px] px-4 text-center text-xs text-graphite sm:px-6">{t("disclaimer")}</p>

      <CtaPanel id="updates-cta" tone="light" title={t("cta.title")} body={t("cta.body")} className="pt-16 lg:pt-24">
        <Button asChild variant="brand" size="pill-lg">
          <SmartLink href={contact.bookingHref}>{tn("book")}</SmartLink>
        </Button>
      </CtaPanel>
    </>
  );
}
