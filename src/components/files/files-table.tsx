import { ArrowDown, ArrowUp, ArrowUpDown, Download } from "lucide-react";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { formatBytes } from "@/lib/format";
import { PAGE_SIZE, type FileRow } from "@/lib/files/queries";
import { FILE_TYPES, kindFromMime, sanitizeDisplayName } from "@/lib/files/rules";
import { cn } from "@/lib/utils";
import type { FileListParams, FileSort } from "@/lib/validation/files";

type Query = Record<string, string>;

function toQuery(params: FileListParams, overrides: Partial<Record<keyof FileListParams, string | number | undefined>>): Query {
  const merged: Record<string, string | number | undefined> = { ...params, ...overrides };
  const out: Query = {};
  for (const [k, v] of Object.entries(merged)) {
    if (v === undefined || v === "") continue;
    if (k === "page" && Number(v) === 1) continue;
    if (k === "sort" && v === "created_at") continue;
    if (k === "dir" && v === "desc") continue;
    out[k] = String(v);
  }
  return out;
}

function SortHeader({
  column,
  label,
  params,
  basePath,
  className,
}: {
  column: FileSort;
  label: string;
  params: FileListParams;
  basePath: "/dashboard";
  className?: string;
}) {
  const active = params.sort === column;
  const nextDir = active && params.dir === "asc" ? "desc" : "asc";
  const Icon = !active ? ArrowUpDown : params.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={active ? (params.dir === "asc" ? "ascending" : "descending") : "none"}
      className={cn("px-3 py-2.5 text-left font-semibold", className)}
    >
      <Link
        href={{ pathname: basePath, query: toQuery(params, { sort: column, dir: nextDir, page: 1 }) }}
        className="inline-flex items-center gap-1 rounded-sm hover:text-primary"
      >
        {label}
        <Icon aria-hidden="true" className={cn("size-3.5", active ? "text-primary" : "text-muted-foreground")} />
      </Link>
    </th>
  );
}

export async function FilesTable({
  rows,
  total,
  pageCount,
  params,
  basePath,
}: {
  rows: FileRow[];
  total: number;
  pageCount: number;
  params: FileListParams;
  basePath: "/dashboard";
}) {
  const t = await getTranslations("Files");
  const locale = await getLocale();
  const format = await getFormatter();
  const page = Math.min(params.page, pageCount);
  const first = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="rounded-lg border bg-card">
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <caption className="sr-only">{t("table.caption")}</caption>
          <thead className="border-b bg-surface text-foreground">
            <tr>
              <SortHeader column="original_name" label={t("table.name")} params={params} basePath={basePath} />
              <th scope="col" className="hidden px-3 py-2.5 text-left font-semibold md:table-cell">
                {t("table.category")}
              </th>
              <th scope="col" className="px-3 py-2.5 text-left font-semibold">
                {t("table.type")}
              </th>
              <SortHeader column="size_bytes" label={t("table.size")} params={params} basePath={basePath} className="text-right" />
              <SortHeader column="created_at" label={t("table.uploaded")} params={params} basePath={basePath} />
              <th scope="col" className="hidden px-3 py-2.5 text-left font-semibold lg:table-cell">
                {t("table.source")}
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">
                <span className="sr-only">{t("table.actions")}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => {
              const name = sanitizeDisplayName(row.originalName);
              const kind = kindFromMime(row.mimeType);
              const byAdmin = row.uploadedBy !== row.ownerId;
              return (
                <tr key={row.id} className="hover:bg-surface/60">
                  <td className="max-w-xs px-3 py-2.5">
                    <p className="truncate font-medium text-foreground" title={name}>
                      {name}
                    </p>
                    {row.description ? (
                      <p className="truncate text-xs text-muted-foreground" title={row.description}>
                        {row.description}
                      </p>
                    ) : null}
                  </td>
                  <td className="hidden px-3 py-2.5 text-muted-foreground md:table-cell">
                    {row.category ? (locale === "es" ? row.category.nameEs : row.category.nameEn) : t("table.noCategory")}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{kind ? FILE_TYPES[kind].label : "—"}</td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap text-muted-foreground tabular-nums">
                    {formatBytes(row.sizeBytes, locale)}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                    <time dateTime={row.createdAt}>{format.dateTime(new Date(row.createdAt), "short")}</time>
                  </td>
                  <td className="hidden px-3 py-2.5 lg:table-cell">
                    <Badge
                      variant="outline"
                      className={cn("font-normal", byAdmin ? "border-info/30 bg-info-bg text-info" : "text-muted-foreground")}
                    >
                      {byAdmin ? t("source.admin") : t("source.self")}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {/* Plain anchor: the route checks permissions and redirects to a 60 s signed URL. */}
                    <a
                      href={`/api/files/${row.id}/download`}
                      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-link hover:bg-accent"
                      aria-label={t("table.downloadLabel", { name })}
                      rel="noopener"
                    >
                      <Download aria-hidden="true" className="size-4" />
                      <span className="hidden sm:inline">{t("table.download")}</span>
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <nav aria-label={t("pagination.label")} className="flex flex-col gap-2 border-t px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground">{t("pagination.summary", { from: first, to: last, total })}</p>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{t("pagination.page", { page, pages: pageCount })}</span>
          {page > 1 ? (
            <Link
              href={{ pathname: basePath, query: toQuery(params, { page: page - 1 }) }}
              className="rounded-md border px-3 py-1.5 hover:bg-accent"
            >
              {t("pagination.previous")}
            </Link>
          ) : (
            <span aria-disabled="true" className="rounded-md border px-3 py-1.5 text-muted-foreground opacity-50">
              {t("pagination.previous")}
            </span>
          )}
          {page < pageCount ? (
            <Link
              href={{ pathname: basePath, query: toQuery(params, { page: page + 1 }) }}
              className="rounded-md border px-3 py-1.5 hover:bg-accent"
            >
              {t("pagination.next")}
            </Link>
          ) : (
            <span aria-disabled="true" className="rounded-md border px-3 py-1.5 text-muted-foreground opacity-50">
              {t("pagination.next")}
            </span>
          )}
        </div>
      </nav>
    </div>
  );
}
