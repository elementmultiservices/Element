import { getLocale, getTranslations } from "next-intl/server";
import { ArrowRight, ArrowUpRight, FileText } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { IRS_CATEGORIES, type IrsUpdate } from "@/lib/irs/newsroom";
import { cn } from "@/lib/utils";

/** IRS category chip, with the IRS's own label in the page language. */
export async function UpdateCategory({ update, className }: { update: IrsUpdate; className?: string }) {
  const locale = toLocale(await getLocale());
  return <span className={cn("rounded-full bg-azure-25 px-3 py-1 text-xs font-medium text-electric", className)}>{IRS_CATEGORIES[update.category][locale]}</span>;
}

/** "IR-2026-84 · July 28, 2026", as the IRS writes it. */
export function UpdateMeta({ update, className }: { update: IrsUpdate; className?: string }) {
  return (
    <p className={cn("font-mono text-xs text-graphite", className)}>
      {update.code ? `${update.code} · ` : null}
      <time dateTime={update.date}>{update.dateLabel}</time>
    </p>
  );
}

/**
 * Link to an update: our own page with its content, or the file on irs.gov
 * for PDFs. `className` styles the link (the whole card is clickable through it).
 */
export async function UpdateLink({ update, className, children }: { update: IrsUpdate; className?: string; children: React.ReactNode }) {
  if (update.slug) {
    return (
      <Link href={`/updates/${update.slug}`} className={className}>
        {children}
      </Link>
    );
  }
  const t = await getTranslations("Updates");
  return (
    <a href={update.url} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
      <span className="sr-only"> {t("opensInNewTab")}</span>
    </a>
  );
}

export async function UpdateCard({ update }: { update: IrsUpdate }) {
  const t = await getTranslations("Updates");
  const Icon = update.slug ? ArrowRight : ArrowUpRight;
  return (
    <article className="group relative flex h-full flex-col gap-4 rounded-[24px] border border-azure-50 bg-mist p-6 transition-[translate,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-[0_24px_48px_rgba(5,13,41,0.08)]">
      <div className="flex flex-wrap items-center gap-2">
        <UpdateCategory update={update} className="bg-white" />
        {update.isPdf ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-ink">
            <FileText aria-hidden="true" className="size-3.5" />
            PDF
          </span>
        ) : null}
      </div>
      <UpdateMeta update={update} />
      <h3 className="text-lg leading-snug font-semibold text-ink">
        <UpdateLink update={update} className="after:absolute after:inset-0 group-hover:text-electric">
          {update.title}
        </UpdateLink>
      </h3>
      {update.summary ? <p className="line-clamp-4 text-sm leading-relaxed text-graphite">{update.summary}</p> : null}
      <span aria-hidden="true" className="mt-auto inline-flex items-center gap-1.5 self-start rounded-full bg-electric px-4 py-2 text-sm font-semibold text-white">
        {update.slug ? t("readUpdate") : update.isPdf ? t("openPdf") : t("readOnIrs")}
        <Icon className="size-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </article>
  );
}
