import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { Pagination, TableShell, Th } from "@/components/tables/table-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Link } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { ADMIN_PAGE_SIZE, listTrash, purgeDate, userDisplayName, userLabels, userOptions } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/session";
import { sanitizeDisplayName } from "@/lib/files/rules";
import { formatBytes } from "@/lib/format";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import { trashListParamsSchema } from "@/lib/validation/admin";
import { TrashRowActions } from "../files/file-row-actions";

export async function generateMetadata({ params }: PageProps<"/[locale]/admin/trash">): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata({ locale: toLocale(locale), path: "/admin/trash", page: "adminTrash", noIndex: true });
}

export default async function AdminTrashPage({ params, searchParams }: PageProps<"/[locale]/admin/trash">) {
  const { locale: rawLocale } = await params;
  const locale = toLocale(rawLocale);
  setRequestLocale(locale);
  await requireAdmin();
  const t = await getTranslations();
  const format = await getFormatter();

  const filters = trashListParamsSchema.parse(await searchParams);
  const supabase = await createClient();
  const [list, owners] = await Promise.all([listTrash(supabase, filters), userOptions(supabase)]);
  const labels = await userLabels(supabase, list.rows.flatMap((f) => [f.ownerId, f.deletedBy]));
  const basePath = "/admin/trash";
  const unknown = t("Admin.common.unknownUser");

  return (
    <>
      <PageHeader
        title={t("Panel.admin.trash")}
        description={t("Admin.trash.description")}
        breadcrumbs={[{ label: t("Panel.adminTitle"), href: "/admin" }, { label: t("Panel.admin.trash") }]}
      />

      <form method="get" role="search" className="mb-4 rounded-[24px] border border-azure-50 bg-white p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="trash-q">{t("Files.filters.search")}</Label>
            <Input id="trash-q" name="q" type="search" maxLength={100} defaultValue={filters.q ?? ""} placeholder={t("Files.filters.searchPlaceholder")} className="h-10" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="trash-owner">{t("Admin.files.owner")}</Label>
            <NativeSelect id="trash-owner" name="owner" defaultValue={filters.owner ?? ""}>
              <option value="">{t("Admin.files.allOwners")}</option>
              {owners
                .filter((o) => o.role === "user")
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.fullName ? `${o.fullName} · ${o.email}` : o.email}
                  </option>
                ))}
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
        <p className="rounded-[24px] border border-dashed border-azure-100 bg-surface px-6 py-10 text-center text-sm text-muted-foreground">{t("Admin.trash.empty")}</p>
      ) : (
        <TableShell
          caption={t("Admin.trash.table.caption")}
          footer={<Pagination params={filters} basePath={basePath} page={list.page} pageCount={list.pageCount} total={list.total} pageSize={ADMIN_PAGE_SIZE} />}
        >
          <thead className="border-b bg-surface">
            <tr>
              <Th>{t("Admin.trash.table.name")}</Th>
              <Th>{t("Admin.trash.table.owner")}</Th>
              <Th className="text-right">{t("Admin.trash.table.size")}</Th>
              <Th>{t("Admin.trash.table.deletedAt")}</Th>
              <Th className="hidden lg:table-cell">{t("Admin.trash.table.deletedBy")}</Th>
              <Th>{t("Admin.trash.table.purgeOn")}</Th>
              <Th className="text-right">
                <span className="sr-only">{t("Admin.common.actions")}</span>
              </Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-azure-50">
            {list.rows.map((f) => {
              const name = sanitizeDisplayName(f.originalName);
              const deletedAt = f.deletedAt ?? f.createdAt;
              return (
                <tr key={f.id} className="transition-colors hover:bg-azure-25/60">
                  <td className="max-w-64 truncate px-4 py-3.5 font-medium" title={name}>
                    {name}
                  </td>
                  <td className="max-w-48 truncate px-4 py-3.5">
                    <Link href={`/admin/users/${f.ownerId}`} className="text-link hover:underline">
                      {userDisplayName(labels.get(f.ownerId), unknown)}
                    </Link>
                  </td>
                  <td className="px-4 py-3.5 text-right whitespace-nowrap text-muted-foreground tabular-nums">{formatBytes(f.sizeBytes, locale)}</td>
                  <td className="px-4 py-3.5 whitespace-nowrap text-muted-foreground">
                    <time dateTime={deletedAt}>{format.dateTime(new Date(deletedAt), "short")}</time>
                  </td>
                  <td className="hidden max-w-48 truncate px-4 py-3.5 text-muted-foreground lg:table-cell">
                    {userDisplayName(f.deletedBy ? labels.get(f.deletedBy) : undefined, unknown)}
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap text-muted-foreground">
                    <time dateTime={purgeDate(deletedAt).toISOString()}>{format.dateTime(purgeDate(deletedAt), "short")}</time>
                  </td>
                  <td className="px-4 py-3.5">
                    <TrashRowActions id={f.id} name={name} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </TableShell>
      )}
    </>
  );
}
