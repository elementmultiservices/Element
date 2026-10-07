import { getLocale, getTranslations } from "next-intl/server";
import { formatBytes, formatPercent } from "@/lib/format";
import type { StorageUsage } from "@/lib/files/queries";
import { cn } from "@/lib/utils";

/** Storage quota indicator (accessible progress meter). */
export async function QuotaMeter({ usage, className }: { usage: StorageUsage; className?: string }) {
  const t = await getTranslations("Quota");
  const locale = await getLocale();
  const ratio = usage.quotaBytes > 0 ? Math.min(usage.usedBytes / usage.quotaBytes, 1) : 1;
  const level = ratio >= 1 ? "full" : ratio >= 0.9 ? "near" : "ok";
  const used = formatBytes(usage.usedBytes, locale);
  const quota = formatBytes(usage.quotaBytes, locale);

  return (
    <section aria-labelledby="quota-heading" className={cn("rounded-lg border bg-card p-4", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="quota-heading" className="text-sm font-semibold">
          {t("title")}
        </h2>
        <span className="text-sm text-muted-foreground">{t("percentUsed", { percent: formatPercent(ratio, locale) })}</span>
      </div>
      <div
        role="meter"
        aria-labelledby="quota-heading"
        aria-valuemin={0}
        aria-valuemax={usage.quotaBytes}
        aria-valuenow={usage.usedBytes}
        aria-valuetext={t("usage", { used, quota })}
        className="mt-3 h-2 overflow-hidden rounded-full bg-secondary"
      >
        <div
          className={cn("h-full rounded-full", level === "ok" ? "bg-primary" : level === "near" ? "bg-warning" : "bg-destructive")}
          style={{ width: `${Math.max(ratio * 100, ratio > 0 ? 1 : 0)}%` }}
        />
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{t("usage", { used, quota })}</p>
      {level !== "ok" ? (
        <p className={cn("mt-1 text-sm", level === "full" ? "text-destructive" : "text-warning")}>
          {level === "full" ? t("full") : t("nearLimit")}
        </p>
      ) : null}
    </section>
  );
}
