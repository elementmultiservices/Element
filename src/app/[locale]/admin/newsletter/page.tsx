import type { Metadata } from "next";
import { ArrowUpRight, History, Languages, Send, UserCheck, Users } from "lucide-react";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { z } from "zod";
import { FormAlert } from "@/components/forms/form-alert";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { Pagination } from "@/components/tables/table-kit";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { toLocale, type AppLocale } from "@/i18n/routing";
import { requireAdmin } from "@/lib/auth/session";
import { IRS_CATEGORIES, listUpdatesWithVersions } from "@/lib/irs/newsroom";
import { countActiveSubscribers, listRecentSends, type NewsletterSend } from "@/lib/newsletter/queries";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import { SendUpdateButton } from "./send-update-button";

const PAGE_SIZE = 15;

const paramsSchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).default(1).catch(1),
});

export async function generateMetadata({ params }: PageProps<"/[locale]/admin/newsletter">): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata({ locale: toLocale(locale), path: "/admin/newsletter", page: "adminNewsletter", noIndex: true });
}

export default async function AdminNewsletterPage({ params, searchParams }: PageProps<"/[locale]/admin/newsletter">) {
  const { locale: rawLocale } = await params;
  const locale = toLocale(rawLocale);
  setRequestLocale(locale);
  await requireAdmin();
  const t = await getTranslations();
  const format = await getFormatter();
  const { page: requestedPage } = paramsSchema.parse(await searchParams);
  const supabase = await createClient();

  const [active, sends, updates] = await Promise.all([countActiveSubscribers(supabase), listRecentSends(supabase), listUpdatesWithVersions()]);
  const ready = active !== null;
  const subscribers = active ?? 0;

  const sendsBySlug = new Map<string, NewsletterSend[]>();
  for (const s of sends) if (s.slug) sendsBySlug.set(s.slug, [...(sendsBySlug.get(s.slug) ?? []), s]);

  const total = updates?.length ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);
  const rows = (updates ?? []).slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  // Admins read the update in the panel language when the IRS published it in that language.
  const pick = (versions: (typeof rows)[number]["versions"]) => versions[locale] ?? versions[locale === "es" ? "en" : ("es" as AppLocale)]!;

  return (
    <>
      <PageHeader
        title={t("Admin.newsletter.title")}
        description={t("Admin.newsletter.description")}
        breadcrumbs={[{ label: t("Panel.adminTitle"), href: "/admin" }, { label: t("Admin.newsletter.title") }]}
        actions={
          <Button asChild variant="outline">
            <Link href="/admin/subscribers">
              <Users aria-hidden="true" />
              {t("Admin.newsletter.subscribersLink")}
            </Link>
          </Button>
        }
      />

      {!ready ? <FormAlert variant="info">{t("Admin.subscribers.migrationNotice")}</FormAlert> : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="relative overflow-hidden rounded-[24px] bg-[linear-gradient(150deg,#050D29_0%,#13295A_60%,#2B56B3_100%)] p-6 text-white">
          <span aria-hidden="true" className="absolute -right-12 -bottom-16 size-44 rounded-full bg-sky/25 blur-3xl" />
          <p className="relative flex items-center gap-2 text-sm text-azure-100">
            <UserCheck aria-hidden="true" className="size-4 text-azure-300" />
            {t("Admin.subscribers.activeCount")}
          </p>
          <p className="relative mt-3 text-[40px] leading-none font-semibold tracking-[-0.03em] tabular-nums">{format.number(subscribers)}</p>
        </div>
        <div className="flex flex-col justify-center gap-2 rounded-[24px] border border-azure-50 bg-white p-6 text-sm text-graphite sm:col-span-2">
          <p className="flex items-start gap-2">
            <Send aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-electric" />
            {t("Admin.newsletter.howTo")}
          </p>
          <p className="flex items-start gap-2">
            <Languages aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-electric" />
            {t("Admin.newsletter.languages")}
          </p>
        </div>
      </div>

      {updates === null ? (
        <FormAlert variant="error">{t("Admin.newsletter.irsUnavailable")}</FormAlert>
      ) : total === 0 ? (
        <EmptyState icon={Send} title={t("Admin.newsletter.emptyTitle")} body={t("Admin.newsletter.emptyBody")} />
      ) : (
        <section aria-labelledby="updates-title" className="rounded-[24px] border border-azure-50 bg-white">
          <h2 id="updates-title" className="border-b border-azure-50 px-5 py-4 text-lg font-semibold text-ink">
            {t("Admin.newsletter.updatesTitle")}
          </h2>
          <ul className="divide-y divide-azure-50">
            {rows.map((row) => {
              const update = pick(row.versions);
              const previous = sendsBySlug.get(row.slug) ?? [];
              const onlyOneLanguage = !row.versions.en || !row.versions.es;
              return (
                <li key={row.slug} className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full bg-azure-25 px-2.5 py-0.5 font-medium text-electric">{IRS_CATEGORIES[update.category][locale]}</span>
                      <span className="font-mono text-graphite">
                        {update.code ? `${update.code} · ` : null}
                        {update.dateLabel}
                      </span>
                      {onlyOneLanguage ? (
                        <span className="rounded-full bg-warning-bg px-2.5 py-0.5 font-medium text-warning">
                          {t("Admin.newsletter.onlyIn", { language: t(`Common.languages.${row.versions.en ? "en" : "es"}`) })}
                        </span>
                      ) : null}
                    </div>
                    <Link
                      href={`/updates/${row.slug}`}
                      locale={update === row.versions.es ? "es" : "en"}
                      target="_blank"
                      className="inline-flex items-start gap-1 font-semibold text-ink hover:text-electric"
                    >
                      {update.title}
                      <ArrowUpRight aria-hidden="true" className="mt-1 size-3.5 shrink-0" />
                    </Link>
                    {previous.length > 0 ? (
                      <p className="flex items-center gap-1.5 text-xs text-graphite">
                        <History aria-hidden="true" className="size-3.5 text-electric" />
                        {t("Admin.newsletter.sentOn", { date: format.dateTime(new Date(previous[0]!.createdAt), "long"), count: previous[0]!.recipients })}
                        {previous.length > 1 ? ` · ${t("Admin.newsletter.timesSent", { count: previous.length })}` : null}
                      </p>
                    ) : null}
                  </div>
                  {ready && subscribers > 0 ? (
                    <SendUpdateButton slug={row.slug} title={update.title} count={subscribers} again={previous.length > 0} />
                  ) : null}
                </li>
              );
            })}
          </ul>
          <div className="border-t border-azure-50 px-5 py-3">
            <Pagination params={{}} basePath="/admin/newsletter" page={page} pageCount={pageCount} total={total} pageSize={PAGE_SIZE} />
          </div>
        </section>
      )}

      {sends.length > 0 ? (
        <section aria-labelledby="history-title" className="mt-6 rounded-[24px] border border-azure-50 bg-white">
          <h2 id="history-title" className="border-b border-azure-50 px-5 py-4 text-lg font-semibold text-ink">
            {t("Admin.newsletter.historyTitle")}
          </h2>
          <ul className="divide-y divide-azure-50">
            {sends.slice(0, 20).map((s) => (
              <li key={s.id} className="flex flex-col gap-1 px-5 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <span className="min-w-0 font-medium text-ink">{s.title}</span>
                <span className="shrink-0 text-xs text-graphite">
                  <time dateTime={s.createdAt}>{format.dateTime(new Date(s.createdAt), "short")}</time>
                  {" · "}
                  {t("Admin.newsletter.recipients", { count: s.recipients })}
                  {s.failed > 0 ? <span className="text-destructive"> · {t("Admin.newsletter.failed", { count: s.failed })}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
