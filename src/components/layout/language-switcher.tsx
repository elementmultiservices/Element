"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, Globe } from "lucide-react";
import { setPreferredLocaleAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePathname, useRouter } from "@/i18n/navigation";
import { locales, type AppLocale } from "@/i18n/routing";
import { cn } from "@/lib/utils";

/**
 * Switches language while staying on the same page; persists the choice.
 * `inline` renders the compact "ES · EN" toggle used on the public site.
 */
export function LanguageSwitcher({ className, variant = "menu" }: { className?: string; variant?: "menu" | "inline" }) {
  const t = useTranslations("Common");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function choose(next: AppLocale) {
    if (next === locale) return;
    startTransition(async () => {
      await setPreferredLocaleAction(next);
      router.replace(`${pathname}${window.location.search}`, { locale: next });
    });
  }

  if (variant === "inline") {
    return (
      <div role="group" aria-label={t("language")} className={cn("flex items-center font-mono text-xs text-graphite", className)}>
        {(["es", "en"] as const).map((l, i) => (
          <span key={l} className="flex items-center">
            {i > 0 ? <span aria-hidden="true">·</span> : null}
            <button
              type="button"
              lang={l}
              onClick={() => choose(l)}
              disabled={isPending}
              aria-pressed={l === locale}
              aria-label={t(`languages.${l}`)}
              className={cn(
                "rounded-sm px-1.5 py-2 uppercase transition-colors hover:text-ink",
                l === locale && "font-medium text-ink",
              )}
            >
              {l}
            </button>
          </span>
        ))}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className={cn("gap-1.5 text-foreground", className)} disabled={isPending}>
          <Globe aria-hidden="true" />
          <span aria-hidden="true" className="uppercase">
            {locale}
          </span>
          <span className="sr-only">{`${t("language")}: ${t(`languages.${locale}`)}`}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuLabel className="text-xs text-muted-foreground">{t("language")}</DropdownMenuLabel>
        {locales.map((l) => (
          <DropdownMenuItem key={l} onSelect={() => choose(l)} lang={l} className="justify-between">
            {t(`languages.${l}`)}
            {l === locale ? <Check aria-hidden="true" className="size-4" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
