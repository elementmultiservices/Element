import { ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export type Crumb = { label: string; href?: string };

/** Page title with breadcrumbs (used inside the panels). */
export async function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
}: {
  title: string;
  description?: string;
  breadcrumbs: Crumb[];
  actions?: React.ReactNode;
}) {
  const t = await getTranslations("Panel");
  return (
    <div className="mb-8 space-y-3">
      <nav aria-label={t("breadcrumb")}>
        <ol className="flex flex-wrap items-center gap-1 font-mono text-xs tracking-[0.04em] text-graphite">
          {breadcrumbs.map((crumb, index) => {
            const last = index === breadcrumbs.length - 1;
            return (
              <li key={`${crumb.label}-${index}`} className="flex items-center gap-1">
                {crumb.href && !last ? (
                  <Link href={crumb.href} className="hover:text-electric">
                    {crumb.label}
                  </Link>
                ) : (
                  <span aria-current={last ? "page" : undefined} className={last ? "text-electric" : undefined}>
                    {crumb.label}
                  </span>
                )}
                {!last ? <ChevronRight aria-hidden="true" className="size-3.5" /> : null}
              </li>
            );
          })}
        </ol>
      </nav>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[30px] leading-tight font-semibold tracking-[-0.02em] text-ink sm:text-4xl">{title}</h1>
          {description ? <p className="mt-2 max-w-2xl text-[15px] text-graphite">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2 sm:shrink-0 sm:justify-end">{actions}</div> : null}
      </div>
    </div>
  );
}
