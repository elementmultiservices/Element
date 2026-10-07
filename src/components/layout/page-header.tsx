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
    <div className="mb-6 space-y-3">
      <nav aria-label={t("breadcrumb")}>
        <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
          {breadcrumbs.map((crumb, index) => {
            const last = index === breadcrumbs.length - 1;
            return (
              <li key={`${crumb.label}-${index}`} className="flex items-center gap-1">
                {crumb.href && !last ? (
                  <Link href={crumb.href} className="hover:text-primary hover:underline">
                    {crumb.label}
                  </Link>
                ) : (
                  <span aria-current={last ? "page" : undefined} className={last ? "text-foreground" : undefined}>
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
          <h1 className="text-2xl">{title}</h1>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
