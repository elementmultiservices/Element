import type { Metadata } from "next";
import { Download, Upload } from "lucide-react";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { Pagination, searchString, SortTh, TableShell, Th } from "@/components/tables/table-kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Link } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { ADMIN_PAGE_SIZE, listAdminFiles, listCategories, userDisplayName, userLabels, userOptions } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/session";
import { FILE_KINDS, FILE_TYPES, kindFromMime, sanitizeDisplayName } from "@/lib/files/rules";
import { formatBytes } from "@/lib/format";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { adminFileListParamsSchema } from "@/lib/validation/admin";
import { TrashFileButton } from "./file-row-actions";

export async function generateMetadata({ params }: PageProps<"/[locale]/admin/files">): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata({ locale: toLocale(locale), path: "/admin/files", page: "adminFiles", noIndex: true });
}

export default async function AdminFilesPage({ params, searchParams }: PageProps<"/[locale]/admin/files">) {
  const { locale: rawLocale } = await params;
  const locale = toLocale(rawLocale);
  setRequestLocale(locale);
  await requireAdmin();
  const t = await getTranslations();
  const format = await getFormatter();

  const filters = adminFileListParamsSchema.parse(await searchParams);
  const supabase = await createClient();
  const [list, owners, categories] = await Promise.all([listAdminFiles(supabase, filters), userOptions(supabase), listCategories(supabase)]);
  const labels = await userLabels(supabase, list.rows.map((f) => f.ownerId));
  const basePath = "/admin/files";
  const unknown = t("Admin.common.unknownUser");

  return (
    <>
      <PageHeader
        title={t("Panel.admin.files")}
        description={t("Admin.files.description")}
        breadcrumbs={[{ label: t("Panel.adminTitle"), href: "/admin" }, { label: t("Panel.admin.files") }]}
        actions={
          <>
            <Button asChild variant="outline">
              <a href={`/api/admin/export/files${searchString({ ...filters, locale })}`}>
                <Download aria-hidden="true" />
                {t("Admin.common.export")}
              </a>
            </Button>
            <Button asChild>
              <Link href={`/admin/files/upload${filters.owner ? `?owner=${filters.owner}` : ""}`}>
                <Upload aria-hidden="true" />
                {t("Admin.files.upload")}
              </Link>
            </Button>
          </>
        }
      />

      <form method="get" role="search" className="mb-4 rounded-[24px] border border-azure-50 bg-white p-4">
        <input type="hidden" name="sort" value={filters.sort} />
        <input type="hidden" name="dir" value={filters.dir} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="files-q">{t("Files.filters.search")}</Label>
            <Input id="files-q" name="q" type="search" maxLength={100} defaultValue={filters.q ?? ""} placeholder={t("Files.filters.searchPlaceholder")} className="h-10" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="files-owner">{t("Admin.files.owner")}</Label>
            <NativeSelect id="files-owner" name="owner" defaultValue={filters.owner ?? ""}>
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
          <div className="space-y-1.5">
            <Label htmlFor="files-type">{t("Files.filters.type")}</Label>
            <NativeSelect id="files-type" name="type" defaultValue={filters.type ?? ""}>
              <option value="">{t("Files.filters.allTypes")}</option>
              {FILE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {FILE_TYPES[k].label}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="files-category">{t("Files.filters.category")}</Label>
            <NativeSelect id="files-category" name="category" defaultValue={filters.category ?? ""}>
              <option value="">{t("Files.filters.allCategories")}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {locale === "es" ? c.nameEs : c.nameEn}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="files-from">{t("Files.filters.from")}</Label>
            <Input id="files-from" name="from" type="date" defaultValue={filters.from ?? ""} className="h-10" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="files-to">{t("Files.filters.to")}</Label>
            <Input id="files-to" name="to" type="date" defaultValue={filters.to ?? ""} className="h-10" />
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
        <p className="rounded-[24px] border border-dashed border-azure-100 bg-surface px-6 py-10 text-center text-sm text-muted-foreground">{t("Admin.files.empty")}</p>
      ) : (
        <TableShell
          caption={t("Admin.files.table.caption")}
          footer={<Pagination params={filters} basePath={basePath} page={list.page} pageCount={list.pageCount} total={list.total} pageSize={ADMIN_PAGE_SIZE} />}
        >
          <thead className="border-b bg-surface">
            <tr>
              <SortTh column="original_name" label={t("Admin.files.table.name")} params={filters} basePath={basePath} />
              <Th>{t("Admin.files.table.owner")}</Th>
              <Th className="hidden xl:table-cell">{t("Admin.files.table.category")}</Th>
              <Th>{t("Admin.files.table.type")}</Th>
              <SortTh column="size_bytes" label={t("Admin.files.table.size")} params={filters} basePath={basePath} className="text-right" />
              <SortTh column="created_at" label={t("Admin.files.table.uploaded")} params={filters} basePath={basePath} />
              <Th className="hidden lg:table-cell">{t("Admin.files.table.source")}</Th>
              <Th className="text-right">
                <span className="sr-only">{t("Admin.common.actions")}</span>
              </Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-azure-50">
            {list.rows.map((f) => {
              const name = sanitizeDisplayName(f.originalName);
              const kind = kindFromMime(f.mimeType);
              const byAdmin = f.uploadedBy !== f.ownerId;
              return (
                <tr key={f.id} className="transition-colors hover:bg-azure-25/60">
                  <td className="max-w-64 px-4 py-3.5">
                    <p className="truncate font-medium" title={name}>
                      {name}
                    </p>
                    {f.description ? (
                      <p className="truncate text-xs text-muted-foreground" title={f.description}>
                        {f.description}
                      </p>
                    ) : null}
                  </td>
                  <td className="max-w-48 px-4 py-3.5">
                    <Link href={`/admin/users/${f.ownerId}`} className="block truncate text-link hover:underline">
                      {userDisplayName(labels.get(f.ownerId), unknown)}
                    </Link>
                  </td>
                  <td className="hidden px-4 py-3.5 text-muted-foreground xl:table-cell">
                    {f.category ? (locale === "es" ? f.category.nameEs : f.category.nameEn) : t("Files.table.noCategory")}
                  </td>
                  <td className="px-4 py-3.5 text-muted-foreground">{kind ? FILE_TYPES[kind].label : "—"}</td>
                  <td className="px-4 py-3.5 text-right whitespace-nowrap text-muted-foreground tabular-nums">{formatBytes(f.sizeBytes, locale)}</td>
                  <td className="px-4 py-3.5 whitespace-nowrap text-muted-foreground">
                    <time dateTime={f.createdAt}>{format.dateTime(new Date(f.createdAt), "short")}</time>
                  </td>
                  <td className="hidden px-4 py-3.5 lg:table-cell">
                    <Badge variant="outline" className={cn("font-normal", byAdmin ? "border-info/30 bg-info-bg text-info" : "text-muted-foreground")}>
                      {byAdmin ? t("Admin.files.byAdmin") : t("Admin.files.byOwner")}
                    </Badge>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center justify-end gap-1">
                      <a
                        href={`/api/files/${f.id}/download`}
                        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold text-electric hover:bg-azure-25"
                        aria-label={t("Files.table.downloadLabel", { name })}
                      >
                        <Download aria-hidden="true" className="size-4" />
                      </a>
                      <TrashFileButton id={f.id} name={name} />
                    </div>
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
