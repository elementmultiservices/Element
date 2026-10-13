"use client";

import { useTranslations } from "next-intl";
import { StatusView } from "@/components/states/status-view";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

/** Generic error view: never shows error details, only an opaque reference. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("ErrorPage");
  return (
    <main id="main-content" className="flex flex-1 items-center">
      <StatusView title={t("title")} body={t("body")} code={error.digest ? t("reference", { digest: error.digest }) : undefined} className="w-full">
        <Button type="button" variant="brand" size="pill-lg" onClick={reset}>
          {t("retry")}
        </Button>
        <Button asChild variant="outline-brand" size="pill-lg">
          <Link href="/">{t("backHome")}</Link>
        </Button>
      </StatusView>
    </main>
  );
}
