"use client";

import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/** Error state inside the panels (keeps the sidebar). Never shows error details. */
export function PanelError({ digest, reset }: { digest?: string; reset: () => void }) {
  const t = useTranslations("ErrorPage");
  return (
    <div role="alert" className="flex flex-col items-center rounded-md border border-destructive/30 bg-error-bg px-6 py-12 text-center">
      <AlertTriangle aria-hidden="true" className="mb-3 size-8 text-destructive" />
      <h1 className="text-lg">{t("title")}</h1>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{t("body")}</p>
      {digest ? <p className="mt-2 text-xs text-muted-foreground">{t("reference", { digest })}</p> : null}
      <Button type="button" className="mt-5" onClick={reset}>
        {t("retry")}
      </Button>
    </div>
  );
}
