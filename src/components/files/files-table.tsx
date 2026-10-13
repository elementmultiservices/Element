import { ArrowDown, ArrowUp, ArrowUpDown, Download, Eye } from "lucide-react";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { FileDetailsToggle } from "./file-details-toggle";
import { formatBytes } from "@/lib/format";
import { PAGE_SIZE, type FileRow } from "@/lib/files/queries";
import { FILE_TYPES, isPreviewable, kindFromMime, sanitizeDisplayName } from "@/lib/files/rules";
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
      className={cn("px-4 py-3 text-left font-mono text-[11px] font-medium tracking-[0.08em] whitespace-nowrap text-graphite uppercase", className)}
    >
      <Link
        href={{ pathname: basePath, query: toQuery(params, { sort: column, dir: nextDir, page: 1 }) }}
        className="inline-flex items-center gap-1 rounded-sm hover:text-electric"
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
    <div className="overflow-hidden rounded-[20px] border border-azure-50 bg-white">
      {/* Mobile: one card per file (name, description and three actions), no sideways scrolling. */}
      <ul aria-label={t("table.caption")} className="divide-y divide-azure-50 sm:hidden">
        {rows.map((row) => {
          const name = sanitizeDisplayName(row.originalName);
          const kind = kindFromMime(row.mimeType);
          const byAdmin = row.uploadedBy !== row.ownerId;
          const action = "inline-flex min-w-0 items-center justify-center gap-1 rounded-full border px-2 py-2 text-[13px] font-semibold whitespace-nowrap";
          const details: [string, string][] = [
            [t("table.category"), row.category ? (locale === "es" ? row.category.nameEs : row.category.nameEn) : t("table.noCategory")],
            [t("table.type"), kind ? FILE_TYPES[kind].label : "—"],
            [t("table.size"), formatBytes(row.sizeBytes, locale)],
            [t("table.uploaded"), format.dateTime(new Date(row.createdAt), "short")],
            [t("table.source"), byAdmin ? t("source.admin") : t("source.self")],
          ];
          return (
            <li key={row.id} className="px-4 py-4">
              <p className="font-medium break-words text-foreground">{name}</p>
              {row.description ? <p className="mt-0.5 text-xs break-words text-muted-foreground">{row.description}</p> : null}
              <FileDetailsToggle
                label={t("table.details")}
                ariaLabel={t("table.detailsLabel", { name })}
                actions={
                  <>
                    {isPreviewable(row.mimeType) ? (
                      <a
                        href={`/api/files/${row.id}/preview`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(action, "border-azure-100 text-electric hover:bg-azure-25")}
                        aria-label={t("table.previewLabel", { name })}
                      >
                        <Eye aria-hidden="true" className="size-4" />
                        <span className="max-[339px]:sr-only">{t("table.preview")}</span>
                      </a>
                    ) : (
                      <span aria-disabled="true" title={t("table.previewUnavailable")} className={cn(action, "border-azure-50 text-muted-foreground opacity-50")}>
                        <Eye aria-hidden="true" className="size-4" />
                        <span className="max-[339px]:sr-only">{t("table.preview")}</span>
                      </span>
                    )}
                    <a
                      href={`/api/files/${row.id}/download`}
                      className={cn(action, "border-electric bg-electric text-white hover:bg-electric/90")}
                      aria-label={t("table.downloadLabel", { name })}
                      rel="noopener"
                    >
                      <Download aria-hidden="true" className="size-4" />
                      <span className="max-[339px]:sr-only">{t("table.download")}</span>
                    </a>
                  </>
                }
              >
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                  {details.map(([term, value]) => (
                    <div key={term} className="contents">
                      <dt className="text-muted-foreground">{term}</dt>
                      <dd className="text-right font-medium text-foreground">{value}</dd>
                    </div>
                  ))}
                </dl>
              </FileDetailsToggle>
            </li>
          );
        })}
      </ul>
      <div className="relative hidden overflow-x-auto sm:block">
        <table className="w-full text-sm">
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
              <th scope="col" className="hidden px-3 py-2.5 text-left font-semibold xl:table-cell">
                {t("table.source")}
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">
                <span className="sr-only">{t("table.actions")}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-azure-50">
            {rows.map((row) => {
              const name = sanitizeDisplayName(row.originalName);
              const kind = kindFromMime(row.mimeType);
              const byAdmin = row.uploadedBy !== row.ownerId;
              return (
                <tr key={row.id} className="transition-colors hover:bg-azure-25/60">
                  <td className="w-full max-w-0 px-4 py-3.5">
                    <p className="truncate font-medium text-foreground" title={name}>
                      {name}
                    </p>
                    {row.description ? (
                      <p className="truncate text-xs text-muted-foreground" title={row.description}>
                        {row.description}
                      </p>
                    ) : null}
                  </td>
                  <td className="hidden px-4 py-3.5 whitespace-nowrap text-muted-foreground md:table-cell">
                    {row.category ? (locale === "es" ? row.category.nameEs : row.category.nameEn) : t("table.noCategory")}
                  </td>
                  <td className="px-4 py-3.5 text-muted-foreground">{kind ? FILE_TYPES[kind].label : "—"}</td>
                  <td className="px-4 py-3.5 text-right whitespace-nowrap text-muted-foreground tabular-nums">
                    {formatBytes(row.sizeBytes, locale)}
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap text-muted-foreground">
                    <time dateTime={row.createdAt}>{format.dateTime(new Date(row.createdAt), "short")}</time>
                  </td>
                  <td className="hidden px-4 py-3.5 xl:table-cell">
                    <Badge
                      variant="outline"
                      className={cn("font-normal", byAdmin ? "border-info/30 bg-info-bg text-info" : "text-muted-foreground")}
                    >
                      {byAdmin ? t("source.admin") : t("source.self")}
                    </Badge>
                  </td>
                  <td className="px-4 py-3.5">
                    {/* Plain anchors: the routes check permissions and redirect to a 60 s signed URL. */}
                    <div className="flex items-center justify-end gap-1">
                      {isPreviewable(row.mimeType) ? (
                        <a
                          href={`/api/files/${row.id}/preview`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex size-9 items-center justify-center rounded-full text-electric hover:bg-azure-25"
                          aria-label={t("table.previewLabel", { name })}
                          title={t("table.preview")}
                        >
                          <Eye aria-hidden="true" className="size-4" />
                        </a>
                      ) : null}
                      <a
                        href={`/api/files/${row.id}/download`}
                        className="inline-flex size-9 items-center justify-center rounded-full text-electric hover:bg-azure-25"
                        aria-label={t("table.downloadLabel", { name })}
                        title={t("table.download")}
                        rel="noopener"
                      >
                        <Download aria-hidden="true" className="size-4" />
                      </a>
                    </div>
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
              className="rounded-full border border-azure-100 px-4 py-1.5 font-medium text-ink hover:bg-azure-25"
            >
              {t("pagination.previous")}
            </Link>
          ) : (
            <span aria-disabled="true" className="rounded-full border border-azure-50 px-4 py-1.5 text-muted-foreground opacity-50">
              {t("pagination.previous")}
            </span>
          )}
          {page < pageCount ? (
            <Link
              href={{ pathname: basePath, query: toQuery(params, { page: page + 1 }) }}
              className="rounded-full border border-azure-100 px-4 py-1.5 font-medium text-ink hover:bg-azure-25"
            >
              {t("pagination.next")}
            </Link>
          ) : (
            <span aria-disabled="true" className="rounded-full border border-azure-50 px-4 py-1.5 text-muted-foreground opacity-50">
              {t("pagination.next")}
            </span>
          )}
        </div>
      </nav>
    </div>
  );
}
