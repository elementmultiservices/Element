"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

/** Generic error view: never shows error details, only an opaque reference. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("ErrorPage");
  return (
    <main id="main-content" className="flex flex-1 items-center">
      <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
        <h1 className="text-3xl">{t("title")}</h1>
        <p className="mt-4 text-muted-foreground">{t("body")}</p>
        {error.digest ? <p className="mt-2 text-xs text-muted-foreground">{t("reference", { digest: error.digest })}</p> : null}
        <div className="mt-8 flex justify-center gap-3">
          <Button type="button" onClick={reset}>
            {t("retry")}
          </Button>
          <Button asChild variant="outline">
            <Link href="/">{t("backHome")}</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
