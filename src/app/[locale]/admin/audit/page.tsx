import type { Metadata } from "next";
import { Download } from "lucide-react";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { Pagination, searchString, TableShell, Th } from "@/components/tables/table-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Link } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { ADMIN_PAGE_SIZE, searchAudit } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/session";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import { describeUserAgent } from "@/lib/user-agent";
import { AUDIT_GROUPS, auditListParamsSchema } from "@/lib/validation/admin";

export async function generateMetadata({ params }: PageProps<"/[locale]/admin/audit">): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata({ locale: toLocale(locale), path: "/admin/audit", page: "adminAudit", noIndex: true });
}

/** Compact, human-readable rendering of the JSON metadata (values are data, never HTML). */
function MetadataList({ value }: { value: unknown }) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return null;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-xs">
      {entries.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="max-w-72 truncate font-mono" title={typeof v === "string" ? v : JSON.stringify(v)}>
            {typeof v === "string" ? v : JSON.stringify(v)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default async function AdminAuditPage({ params, searchParams }: PageProps<"/[locale]/admin/audit">) {
  const { locale: rawLocale } = await params;
  const locale = toLocale(rawLocale);
  setRequestLocale(locale);
  await requireAdmin();
  const t = await getTranslations();
  const format = await getFormatter();

  const filters = auditListParamsSchema.parse(await searchParams);
  const supabase = await createClient();
  const list = await searchAudit(supabase, filters);
  const basePath = "/admin/audit";

  return (
    <>
      <PageHeader
        title={t("Panel.admin.audit")}
        description={t("Admin.audit.description")}
        breadcrumbs={[{ label: t("Panel.adminTitle"), href: "/admin" }, { label: t("Panel.admin.audit") }]}
        actions={
          <Button asChild variant="outline">
            <a href={`/api/admin/export/audit${searchString({ ...filters, locale })}`}>
              <Download aria-hidden="true" />
              {t("Admin.common.export")}
            </a>
          </Button>
        }
      />

      <form method="get" role="search" className="mb-4 rounded-lg border bg-card p-4">
        {filters.subject ? <input type="hidden" name="subject" value={filters.subject} /> : null}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
            <Label htmlFor="audit-q">{t("Admin.audit.searchLabel")}</Label>
            <Input id="audit-q" name="q" type="search" maxLength={200} defaultValue={filters.q ?? ""} placeholder={t("Admin.audit.searchPlaceholder")} className="h-10" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="audit-action">{t("Admin.audit.action")}</Label>
            <NativeSelect id="audit-action" name="action" defaultValue={filters.action ?? ""}>
              <option value="">{t("Admin.audit.allActions")}</option>
              {AUDIT_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {t(`Admin.audit.groups.${g}`)}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="audit-actor">{t("Admin.audit.actor")}</Label>
            <Input id="audit-actor" name="actor" type="search" maxLength={100} defaultValue={filters.actor ?? ""} placeholder={t("Admin.audit.actorPlaceholder")} className="h-10" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="audit-from">{t("Admin.common.from")}</Label>
            <Input id="audit-from" name="from" type="date" defaultValue={filters.from ?? ""} className="h-10" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="audit-to">{t("Admin.common.to")}</Label>
            <Input id="audit-to" name="to" type="date" defaultValue={filters.to ?? ""} className="h-10" />
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
        <p className="rounded-lg border border-dashed bg-surface px-6 py-10 text-center text-sm text-muted-foreground">{t("Admin.audit.empty")}</p>
      ) : (
        <TableShell
          caption={t("Admin.audit.table.caption")}
          footer={<Pagination params={filters} basePath={basePath} page={list.page} pageCount={list.pageCount} total={list.total} pageSize={ADMIN_PAGE_SIZE} />}
        >
          <thead className="border-b bg-surface">
            <tr>
              <Th>{t("Admin.audit.table.date")}</Th>
              <Th>{t("Admin.audit.table.action")}</Th>
              <Th>{t("Admin.audit.table.actor")}</Th>
              <Th>{t("Admin.audit.table.target")}</Th>
              <Th className="hidden lg:table-cell">{t("Admin.audit.table.ip")}</Th>
              <Th className="hidden xl:table-cell">{t("Admin.audit.table.details")}</Th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {list.rows.map((a) => (
              <tr key={a.id} className="align-top hover:bg-surface/60">
                <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                  <time dateTime={a.createdAt}>{format.dateTime(new Date(a.createdAt), "long")}</time>
                </td>
                <td className="px-3 py-2.5">
                  <code className="text-xs font-semibold text-primary">{a.action}</code>
                </td>
                <td className="max-w-48 px-3 py-2.5">
                  {a.actorId ? (
                    <Link href={`/admin/users/${a.actorId}`} className="block truncate text-link hover:underline" title={a.actorEmail ?? undefined}>
                      {a.actorName?.trim() || a.actorEmail || t("Admin.common.unknownUser")}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">{t("Admin.common.system")}</span>
                  )}
                </td>
                <td className="max-w-56 px-3 py-2.5">
                  {a.targetType ? (
                    <>
                      <span className="text-xs text-muted-foreground">{a.targetType}</span>
                      {a.targetType === "user" && a.targetId ? (
                        <Link href={`/admin/users/${a.targetId}`} className="block truncate text-link hover:underline">
                          {a.targetLabel ?? a.targetId}
                        </Link>
                      ) : (
                        <p className="truncate" title={a.targetLabel ?? a.targetId ?? undefined}>
                          {a.targetLabel ?? a.targetId}
                        </p>
                      )}
                    </>
                  ) : null}
                </td>
                <td className="hidden px-3 py-2.5 lg:table-cell">
                  <p className="font-mono text-xs">{a.ip ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">{describeUserAgent(a.userAgent) ?? ""}</p>
                </td>
                <td className="hidden px-3 py-2.5 xl:table-cell">
                  <MetadataList value={a.metadata} />
                </td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}
    </>
  );
}
