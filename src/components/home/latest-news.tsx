import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { NewsletterCard } from "@/components/newsletter/newsletter-card";
import { UpdateCategory, UpdateLink, UpdateMeta } from "@/components/updates/update-card";
import { UpdateVisual } from "@/components/updates/update-visual";
import type { AppLocale } from "@/i18n/routing";
import { IRS_CATEGORIES, loadIrsUpdates } from "@/lib/irs/newsroom";
import { stagger } from "@/components/marketing/motion";
import { container, SectionIntro } from "@/components/marketing/section-intro";

/** Home section: the three most recent IRS updates. */
export async function LatestNews({ locale }: { locale: AppLocale }) {
  const [t, tu, updates] = await Promise.all([getTranslations("Home.updates"), getTranslations("Updates"), loadIrsUpdates(locale)]);
  const [featured, ...rest] = (updates ?? []).slice(0, 3);

  return (
    <section aria-labelledby="news-title" className={`${container} flex flex-col gap-10 py-16 lg:py-24`}>
      <SectionIntro id="news-title" align="center" eyebrow={t("eyebrow")} title={t("title")} body={t("body")} />
      {!featured ? (
        <div className="mx-auto flex w-full max-w-[560px] flex-col gap-6">
          <p className="text-center text-graphite">{t("empty")}</p>
          <NewsletterCard source="home" className="reveal" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          <article className="reveal group relative flex min-w-0 flex-col overflow-hidden rounded-[28px] border border-azure-50 bg-white transition-shadow duration-300 hover:shadow-[0_24px_48px_rgba(5,13,41,0.08)]">
            <UpdateVisual
              category={featured.category}
              label={IRS_CATEGORIES[featured.category][locale]}
              code={featured.code}
              className="aspect-[16/9] lg:aspect-auto lg:min-h-[300px] lg:flex-1"
            />
            <div className="flex flex-col gap-3 p-6 lg:p-8">
              <div className="flex flex-col items-start gap-2">
                <UpdateCategory update={featured} />
                <UpdateMeta update={featured} />
              </div>
              <h3 className="text-2xl leading-tight font-semibold text-ink lg:text-[28px]">
                <UpdateLink update={featured} className="after:absolute after:inset-0 group-hover:text-electric">
                  {featured.title}
                </UpdateLink>
              </h3>
              {featured.summary ? <p className="line-clamp-3 text-base text-graphite">{featured.summary}</p> : null}
              <span aria-hidden="true" className="mt-2 inline-flex items-center gap-1.5 self-start rounded-full bg-electric px-4 py-2 text-sm font-semibold text-white">
                {featured.slug ? tu("readUpdate") : featured.isPdf ? tu("openPdf") : tu("readOnIrs")}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </div>
          </article>
          <div className="flex flex-col gap-4">
            {rest.map((update, i) => (
              <article
                key={update.url}
                style={stagger(i + 1)}
                className="reveal group relative flex flex-col items-start gap-2.5 rounded-[24px] border border-azure-50 bg-white p-5 transition-shadow duration-300 hover:shadow-[0_16px_32px_rgba(5,13,41,0.06)]"
              >
                <UpdateCategory update={update} />
                <UpdateMeta update={update} />
                <h3 className="line-clamp-3 text-lg leading-snug font-semibold text-ink">
                  <UpdateLink update={update} className="after:absolute after:inset-0 group-hover:text-electric">
                    {update.title}
                  </UpdateLink>
                </h3>
              </article>
            ))}
            <NewsletterCard source="home" className="reveal" />
            <Link
              href="/updates"
              className="mt-auto inline-flex min-h-14 items-center justify-center gap-2 rounded-full border border-azure-100 px-7 text-[17px] font-semibold text-ink transition-colors hover:bg-azure-25"
            >
              {t("viewAll")}
              <ArrowRight aria-hidden="true" className="size-[18px]" />
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
