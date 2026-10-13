"use client";

import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/** Error state inside the panels (keeps the sidebar). Never shows error details. */
export function PanelError({ digest, reset }: { digest?: string; reset: () => void }) {
  const t = useTranslations("ErrorPage");
  return (
    <div role="alert" className="flex flex-col items-center rounded-[24px] border border-destructive/20 bg-white px-6 py-14 text-center">
      <span className="mb-4 flex size-14 items-center justify-center rounded-full bg-error-bg"><AlertTriangle aria-hidden="true" className="size-6 text-destructive" /></span>
      <h1 className="text-xl font-semibold text-ink">{t("title")}</h1>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{t("body")}</p>
      {digest ? <p className="mt-2 text-xs text-muted-foreground">{t("reference", { digest })}</p> : null}
      <Button type="button" className="mt-5" onClick={reset}>
        {t("retry")}
      </Button>
    </div>
  );
}
