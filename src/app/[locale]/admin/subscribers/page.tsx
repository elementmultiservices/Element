import type { Metadata } from "next";
import { Download, Mail, Send, UserCheck, UserX } from "lucide-react";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { z } from "zod";
import { FormAlert } from "@/components/forms/form-alert";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { Pagination, searchString, TableShell, Th } from "@/components/tables/table-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Link } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { requireAdmin } from "@/lib/auth/session";
import { countActiveSubscribers, listSubscribers, SUBSCRIBER_STATUSES, SUBSCRIBERS_PAGE_SIZE } from "@/lib/newsletter/queries";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { RemoveSubscriber } from "./subscriber-actions";

const SOURCES = ["footer", "home", "blog", "admin"] as const;

const paramsSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  status: z.enum([...SUBSCRIBER_STATUSES, "all"]).default("active").catch("active"),
  page: z.coerce.number().int().min(1).max(10_000).default(1).catch(1),
});

export async function generateMetadata({ params }: PageProps<"/[locale]/admin/subscribers">): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata({ locale: toLocale(locale), path: "/admin/subscribers", page: "adminSubscribers", noIndex: true });
}

export default async function AdminSubscribersPage({ params, searchParams }: PageProps<"/[locale]/admin/subscribers">) {
  const { locale: rawLocale } = await params;
  const locale = toLocale(rawLocale);
  setRequestLocale(locale);
  await requireAdmin();
  const t = await getTranslations();
  const format = await getFormatter();
  const filters = paramsSchema.parse(await searchParams);
  const supabase = await createClient();

  const [list, active] = await Promise.all([
    listSubscribers(supabase, { status: filters.status === "all" ? undefined : filters.status, q: filters.q, page: filters.page }),
    countActiveSubscribers(supabase),
  ]);
  const basePath = "/admin/subscribers";
  const listParams = { q: filters.q, status: filters.status === "active" ? undefined : filters.status };
  const sourceLabel = (s: string) => ((SOURCES as readonly string[]).includes(s) ? t(`Admin.subscribers.sources.${s as (typeof SOURCES)[number]}`) : s);

  return (
    <>
      <PageHeader
        title={t("Admin.subscribers.title")}
        description={t("Admin.subscribers.description")}
        breadcrumbs={[{ label: t("Panel.adminTitle"), href: "/admin" }, { label: t("Admin.subscribers.title") }]}
        actions={
          list.ready ? (
            <>
              <Button asChild variant="outline">
                <a href={`/api/admin/export/subscribers${searchString({ ...listParams, locale })}`}>
                  <Download aria-hidden="true" />
                  {t("Admin.subscribers.export")}
                </a>
              </Button>
              <Button asChild>
                <Link href="/admin/blog">
                  <Send aria-hidden="true" />
                  {t("Admin.subscribers.sendFromBlog")}
                </Link>
              </Button>
            </>
          ) : null
        }
      />

      {!list.ready ? (
        <FormAlert variant="info">{t("Admin.subscribers.migrationNotice")}</FormAlert>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <div className="relative overflow-hidden rounded-[24px] bg-[linear-gradient(150deg,#050D29_0%,#13295A_60%,#2B56B3_100%)] p-6 text-white">
              <span aria-hidden="true" className="absolute -right-12 -bottom-16 size-44 rounded-full bg-sky/25 blur-3xl" />
              <p className="relative flex items-center gap-2 text-sm text-azure-100">
                <UserCheck aria-hidden="true" className="size-4 text-azure-300" />
                {t("Admin.subscribers.activeCount")}
              </p>
              <p className="relative mt-3 text-[40px] leading-none font-semibold tracking-[-0.03em] tabular-nums">{format.number(active ?? 0)}</p>
            </div>
            <div className="flex flex-col justify-center gap-2 rounded-[24px] border border-azure-50 bg-white p-6 text-sm text-graphite sm:col-span-2">
              <p className="flex items-start gap-2">
                <Mail aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-electric" />
                {t("Admin.subscribers.howTo")}
              </p>
              <p className="flex items-start gap-2">
                <UserX aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-electric" />
                {t("Admin.subscribers.unsubscribeInfo")}
              </p>
            </div>
          </div>

          <form method="get" role="search" className="mb-4 rounded-[24px] border border-azure-50 bg-white p-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="sub-q">{t("Admin.subscribers.search")}</Label>
                <Input id="sub-q" name="q" type="search" maxLength={100} defaultValue={filters.q ?? ""} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sub-status">{t("Admin.subscribers.status")}</Label>
                <NativeSelect id="sub-status" name="status" defaultValue={filters.status}>
                  <option value="active">{t("Admin.subscribers.statuses.active")}</option>
                  <option value="unsubscribed">{t("Admin.subscribers.statuses.unsubscribed")}</option>
                  <option value="all">{t("Admin.subscribers.statuses.all")}</option>
                </NativeSelect>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="submit" size="sm">
                {t("Admin.common.apply")}
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={basePath}>{t("Admin.common.clear")}</Link>
              </Button>
            </div>
          </form>

          {list.total === 0 ? (
            <EmptyState icon={Mail} title={t("Admin.subscribers.emptyTitle")} body={t("Admin.subscribers.emptyBody")} />
          ) : (
            <TableShell
              caption={t("Admin.subscribers.title")}
              footer={
                <Pagination params={listParams} basePath={basePath} page={list.page} pageCount={list.pageCount} total={list.total} pageSize={SUBSCRIBERS_PAGE_SIZE} />
              }
            >
              <thead className="border-b bg-surface">
                <tr>
                  <Th>{t("Admin.subscribers.table.email")}</Th>
                  <Th>{t("Admin.subscribers.table.language")}</Th>
                  <Th>{t("Admin.subscribers.table.source")}</Th>
                  <Th>{t("Admin.subscribers.table.date")}</Th>
                  <Th>{t("Admin.subscribers.table.status")}</Th>
                  <Th className="text-right">
                    <span className="sr-only">{t("Admin.common.actions")}</span>
                  </Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-azure-50">
                {list.rows.map((s) => (
                  <tr key={s.id} className="transition-colors hover:bg-azure-25/60">
                    <td className="px-4 py-3.5 font-medium text-ink">{s.email}</td>
                    <td className="px-4 py-3.5">
                      <span className="rounded-full bg-azure-25 px-2 py-0.5 font-mono text-[11px] text-navy uppercase">{s.locale}</span>
                    </td>
                    <td className="px-4 py-3.5 text-muted-foreground">{sourceLabel(s.source)}</td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-muted-foreground">
                      <time dateTime={s.createdAt}>{format.dateTime(new Date(s.createdAt), "short")}</time>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-xs font-medium",
                          s.unsubscribedAt ? "bg-warning-bg text-warning" : "bg-success-bg text-success",
                        )}
                      >
                        {s.unsubscribedAt ? t("Admin.subscribers.statuses.unsubscribed") : t("Admin.subscribers.statuses.active")}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <RemoveSubscriber id={s.id} email={s.email} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
          )}
        </>
      )}
    </>
  );
}
