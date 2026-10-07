import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * Server-rendered table helpers for list pages whose state (filters, sort,
 * page) lives in the URL.
 */

type ParamValue = string | number | undefined | null;
export type ListParams = Record<string, ParamValue>;

const DEFAULTS: Record<string, string> = { page: "1", sort: "created_at", dir: "desc" };

/** Serializes list params, dropping empty values and defaults. */
export function queryFor(params: ListParams, overrides: ListParams = {}): Record<string, string> {
  const merged = { ...params, ...overrides };
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(merged)) {
    if (v === undefined || v === null || v === "") continue;
    const s = String(v);
    if (DEFAULTS[k] === s) continue;
    out[k] = s;
  }
  return out;
}

/** Same as queryFor, as a "?a=b" string (for plain anchors such as CSV exports). */
export function searchString(params: ListParams, overrides: ListParams = {}): string {
  const qs = new URLSearchParams(queryFor(params, overrides)).toString();
  return qs ? `?${qs}` : "";
}

export function TableShell({ caption, children, footer }: { caption: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card">
      {/* `relative` keeps sr-only descendants from widening the page on mobile. */}
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <caption className="sr-only">{caption}</caption>
          {children}
        </table>
      </div>
      {footer}
    </div>
  );
}

export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th scope="col" className={cn("px-3 py-2.5 text-left font-semibold whitespace-nowrap", className)}>
      {children}
    </th>
  );
}

export function SortTh({
  column,
  label,
  params,
  basePath,
  className,
}: {
  column: string;
  label: string;
  params: ListParams & { sort: string; dir: string };
  basePath: string;
  className?: string;
}) {
  const active = params.sort === column;
  const nextDir = active && params.dir === "asc" ? "desc" : "asc";
  const Icon = !active ? ArrowUpDown : params.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={active ? (params.dir === "asc" ? "ascending" : "descending") : "none"}
      className={cn("px-3 py-2.5 text-left font-semibold whitespace-nowrap", className)}
    >
      <Link
        href={{ pathname: basePath, query: queryFor(params, { sort: column, dir: nextDir, page: 1 }) }}
        className="inline-flex items-center gap-1 rounded-sm hover:text-primary"
      >
        {label}
        <Icon aria-hidden="true" className={cn("size-3.5", active ? "text-primary" : "text-muted-foreground")} />
      </Link>
    </th>
  );
}

export async function Pagination({
  params,
  basePath,
  page,
  pageCount,
  total,
  pageSize,
}: {
  params: ListParams;
  basePath: string;
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
}) {
  const t = await getTranslations("Admin.pagination");
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  const linkClass = "rounded-md border px-3 py-1.5 hover:bg-accent";
  const disabledClass = "rounded-md border px-3 py-1.5 text-muted-foreground opacity-50";

  return (
    <nav aria-label={t("label")} className="flex flex-col gap-2 border-t px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="text-muted-foreground">{t("summary", { from: first, to: last, total })}</p>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{t("page", { page, pages: pageCount })}</span>
        {page > 1 ? (
          <Link href={{ pathname: basePath, query: queryFor(params, { page: page - 1 }) }} className={linkClass}>
            {t("previous")}
          </Link>
        ) : (
          <span aria-disabled="true" className={disabledClass}>
            {t("previous")}
          </span>
        )}
        {page < pageCount ? (
          <Link href={{ pathname: basePath, query: queryFor(params, { page: page + 1 }) }} className={linkClass}>
            {t("next")}
          </Link>
        ) : (
          <span aria-disabled="true" className={disabledClass}>
            {t("next")}
          </span>
        )}
      </div>
    </nav>
  );
}
