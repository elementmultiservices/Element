import { getTranslations } from "next-intl/server";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, type LucideIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { pageWindow } from "@/lib/page-window";
import { cn } from "@/lib/utils";

type Href = { pathname: "/updates"; query: Record<string, string> };

const box = "inline-flex size-11 items-center justify-center rounded-full text-sm font-semibold transition-colors";

/** Numbered pagination with first / previous / next / last. */
export async function Pagination({ page, pageCount, href }: { page: number; pageCount: number; href: (page: number) => Href }) {
  if (pageCount <= 1) return null;
  const t = await getTranslations("Updates.pagination");

  const arrow = (target: number, label: string, Icon: LucideIcon, className?: string) =>
    target === page || target < 1 || target > pageCount ? (
      <span aria-hidden="true" className={cn(box, "text-graphite/40", className)}>
        <Icon className="size-4" />
      </span>
    ) : (
      <Link href={href(target)} aria-label={label} title={label} className={cn(box, "border border-azure-100 text-ink hover:bg-azure-25", className)}>
        <Icon aria-hidden="true" className="size-4" />
      </Link>
    );

  return (
    <nav aria-label={t("label")} className="mx-auto mt-12 flex max-w-[1240px] flex-col items-center gap-3 px-4 sm:px-6">
      <ul className="flex flex-wrap items-center justify-center gap-1.5">
        <li>{arrow(1, t("first"), ChevronsLeft, "hidden sm:inline-flex")}</li>
        <li>{arrow(page - 1, t("previous"), ChevronLeft)}</li>
        {pageWindow(page, pageCount).map((p, i) => (
          <li key={p === "gap" ? `gap-${i}` : p}>
            {p === "gap" ? (
              <span aria-hidden="true" className={cn(box, "w-6 text-graphite")}>
                …
              </span>
            ) : p === page ? (
              <span aria-current="page" className={cn(box, "bg-ink text-white")}>
                <span className="sr-only">{t("pageN", { page: p })}</span>
                <span aria-hidden="true">{p}</span>
              </span>
            ) : (
              <Link href={href(p)} aria-label={t("pageN", { page: p })} className={cn(box, "text-ink hover:bg-azure-25")}>
                {p}
              </Link>
            )}
          </li>
        ))}
        <li>{arrow(page + 1, t("next"), ChevronRight)}</li>
        <li>{arrow(pageCount, t("last"), ChevronsRight, "hidden sm:inline-flex")}</li>
      </ul>
      <p className="font-mono text-xs text-graphite">{t("page", { page, pages: pageCount })}</p>
    </nav>
  );
}
