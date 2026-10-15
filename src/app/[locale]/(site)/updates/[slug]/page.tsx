import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft, ArrowRight, ArrowUpRight, MessageCircle } from "lucide-react";
import { delay, stagger } from "@/components/marketing/motion";
import { SmartLink } from "@/components/marketing/smart-link";
import { Button } from "@/components/ui/button";
import { UpdateCard, UpdateCategory, UpdateLink } from "@/components/updates/update-card";
import { Link } from "@/i18n/navigation";
import { toLocale, type AppLocale } from "@/i18n/routing";
import { getIrsArticle, IRS_CATEGORIES, loadIrsUpdates } from "@/lib/irs/newsroom";
import { getSiteContact } from "@/lib/site-settings";
import { pageMetadata } from "@/lib/seo";

/** The update, null when it does not exist, "error" when the IRS cannot be reached. */
async function load(locale: AppLocale, slug: string) {
  try {
    return await getIrsArticle(locale, slug);
  } catch (error) {
    console.error(error);
    return "error" as const;
  }
}

export async function generateMetadata({ params }: PageProps<"/[locale]/updates/[slug]">): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  const locale = toLocale(rawLocale);
  const data = await load(locale, slug);
  const found = data && data !== "error" ? data : null;
  return pageMetadata({
    locale,
    path: `/updates/${slug}`,
    page: "updates",
    title: found?.article.title,
    description: found?.update.summary,
    descriptionKey: "updates",
    type: "article",
    publishedTime: found?.update.date,
  });
}

export default async function UpdatePage({ params }: PageProps<"/[locale]/updates/[slug]">) {
  const { locale: rawLocale, slug } = await params;
  const locale = toLocale(rawLocale);
  setRequestLocale(locale);
  const [t, tn, contact, data, all] = await Promise.all([
    getTranslations("Updates"),
    getTranslations("Nav"),
    getSiteContact(),
    load(locale, slug),
    loadIrsUpdates(locale),
  ]);
  if (!data) notFound();

  const back = (
    <Link
      href="/updates"
      className="group inline-flex items-center gap-2 rounded-full border border-azure-100 px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-azure-25"
    >
      <ArrowLeft aria-hidden="true" className="size-4 transition-transform group-hover:-translate-x-0.5" />
      {t("backToUpdates")}
    </Link>
  );

  if (data === "error") {
    return (
      <div className="mx-auto flex w-full max-w-[760px] flex-col items-start gap-8 px-4 pt-10 pb-24 sm:px-6 lg:pt-14">
        {back}
        <p className="w-full rounded-[24px] border border-dashed border-azure-100 bg-mist px-6 py-14 text-center text-graphite">{t("articleUnavailable")}</p>
      </div>
    );
  }

  const { update, article } = data;
  const others = (all ?? []).filter((u) => u.url !== update.url && u.slug !== slug);
  const sideRecent = others.slice(0, 4);
  const moreRecent = others.slice(4, 7).length === 3 ? others.slice(4, 7) : others.slice(0, 3);

  const facts = [
    { label: t("facts.category"), value: IRS_CATEGORIES[update.category][locale] },
    update.code ? { label: t("facts.number"), value: update.code } : null,
    { label: t("facts.date"), value: update.dateLabel },
  ].filter((f): f is { label: string; value: string } => f !== null);

  const sourceButton = (className: string) => (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`group inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-electric px-5 text-sm font-semibold text-white transition-colors hover:bg-electric-hover ${className}`}
    >
      {t("goToSource")}
      <ArrowUpRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      <span className="sr-only"> {t("opensInNewTab")}</span>
    </a>
  );

  return (
    <>
      <article className="mx-auto w-full max-w-[1240px] px-4 pt-10 pb-16 sm:px-6 lg:pt-14 lg:pb-24">
        {back}

        <header style={delay(1)} className="motion-enter mt-8 max-w-[980px]">
          <div className="flex flex-wrap items-center gap-3">
            <UpdateCategory update={update} />
            <p className="font-mono text-xs text-graphite">
              {update.code ? `${update.code} · ` : null}
              <time dateTime={update.date}>{update.dateLabel}</time>
            </p>
          </div>
          <h1 className="mt-5 text-[32px] leading-[1.06] font-semibold tracking-[-0.025em] text-ink sm:text-[44px] lg:text-[52px]">{article.title}</h1>
          {update.summary ? <p className="mt-6 max-w-[760px] text-lg leading-relaxed text-graphite sm:text-xl">{update.summary}</p> : null}
        </header>

        <div aria-hidden="true" className="mt-10 h-px bg-azure-50 lg:mt-12" />

        <div className="mt-10 grid gap-12 lg:mt-14 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-16">
          <div className="min-w-0 max-w-[760px]">
            {/* IRS article body, sanitized with the rich-HTML allowlist (parseIrsArticle). */}
            <div style={delay(3)} className="motion-enter prose-element lg:text-[1.1875rem]" dangerouslySetInnerHTML={{ __html: article.html }} />

            <div className="mt-12 flex flex-col gap-4 rounded-[24px] border border-azure-50 bg-mist p-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-1">
                <p className="font-semibold text-ink">{t("sourceTitle")}</p>
                <p className="text-sm text-graphite">{t("sourceBody")}</p>
              </div>
              {sourceButton("shrink-0")}
            </div>
            <p className="mt-6 text-xs text-graphite">{t("disclaimer")}</p>
          </div>

          <aside style={delay(4)} className="motion-enter flex flex-col gap-4 lg:sticky lg:top-32 lg:self-start">
            <section aria-labelledby="update-facts" className="rounded-[24px] border border-azure-50 bg-white p-6">
              <h2 id="update-facts" className="font-mono text-xs font-normal tracking-[0.1em] text-graphite uppercase">
                {t("facts.title")}
              </h2>
              <dl className="mt-4 divide-y divide-azure-50">
                {facts.map((f) => (
                  <div key={f.label} className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
                    <dt className="shrink-0 text-graphite">{f.label}</dt>
                    <dd className="text-right font-medium text-ink">{f.value}</dd>
                  </div>
                ))}
              </dl>
              {sourceButton("mt-4 w-full")}
            </section>

            <section
              aria-labelledby="update-help"
              className="relative overflow-hidden rounded-[24px] bg-[linear-gradient(160deg,#050D29_0%,#13295A_60%,#2B56B3_100%)] p-6 text-white"
            >
              <span aria-hidden="true" className="motion-float absolute -right-12 -bottom-16 size-44 rounded-full bg-sky/25 blur-3xl" />
              <h2 id="update-help" className="relative text-xl leading-tight font-semibold text-white">
                {t("sidebarCta.title")}
              </h2>
              <p className="relative mt-2 text-sm leading-relaxed text-azure-100">{t("sidebarCta.body")}</p>
              <div className="relative mt-5 flex flex-col gap-2">
                <Button asChild variant="brand">
                  <SmartLink href={contact.bookingHref}>{tn("book")}</SmartLink>
                </Button>
                <Button asChild className="bg-white text-ink hover:bg-azure-25">
                  <SmartLink href={contact.whatsappHref}>
                    <MessageCircle aria-hidden="true" />
                    {tn("whatsapp")}
                  </SmartLink>
                </Button>
              </div>
            </section>

            {sideRecent.length > 0 ? (
              <section aria-labelledby="update-recent" className="hidden rounded-[24px] border border-azure-50 bg-white p-6 lg:block">
                <h2 id="update-recent" className="font-mono text-xs font-normal tracking-[0.1em] text-graphite uppercase">
                  {t("latest")}
                </h2>
                <ul className="mt-4 flex flex-col divide-y divide-azure-50">
                  {sideRecent.map((u) => (
                    <li key={u.url} className="group relative flex flex-col items-start gap-1.5 py-3 first:pt-0 last:pb-0">
                      <span className="text-xs font-medium text-electric">{IRS_CATEGORIES[u.category][locale]}</span>
                      <UpdateLink update={u} className="line-clamp-2 text-sm leading-snug font-semibold text-ink after:absolute after:inset-0 group-hover:text-electric">
                        {u.title}
                      </UpdateLink>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </aside>
        </div>
      </article>

      {moreRecent.length > 0 ? (
        <section aria-labelledby="keep-reading" className="border-t border-azure-50 bg-mist py-16 lg:py-20">
          <div className="mx-auto flex max-w-[1240px] flex-col gap-8 px-4 sm:px-6">
            <div className="reveal flex flex-wrap items-end justify-between gap-4">
              <h2 id="keep-reading" className="text-[32px] leading-[1.05] font-semibold tracking-[-0.02em] text-ink sm:text-[44px]">
                {t("keepReading")}
              </h2>
              <Link href="/updates" className="group inline-flex items-center gap-2 text-sm font-semibold text-electric">
                {t("viewAll")}
                <ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {moreRecent.map((u, i) => (
                <li key={u.url} style={stagger(i)} className="reveal">
                  <UpdateCard update={u} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
    </>
  );
}
