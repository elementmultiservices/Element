"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { COOKIE_NOTICE_NAME as COOKIE } from "@/lib/cookie-notice";

/**
 * Informative cookie notice. Only strictly necessary cookies are used, so no
 * consent gating is required; the notice is shown until it is acknowledged.
 * Visibility is decided on the server from the cookie (no layout shift).
 */
export function CookieNotice({ initiallyVisible }: { initiallyVisible: boolean }) {
  const t = useTranslations("CookieNotice");
  const [visible, setVisible] = useState(initiallyVisible);
  if (!visible) return null;

  function acknowledge() {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${COOKIE}=1; Max-Age=${60 * 60 * 24 * 365}; Path=/; SameSite=Lax${secure}`;
    setVisible(false);
  }

  return (
    <section
      role="region"
      aria-label={t("label")}
      className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/98 shadow-[0_-2px_8px_rgba(11,37,69,0.08)]"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="text-sm text-foreground">
          {t("text")}{" "}
          <Link href="/legal/cookies" className="text-link underline">
            {t("link")}
          </Link>
        </p>
        <Button type="button" size="sm" onClick={acknowledge} className="shrink-0">
          {t("accept")}
        </Button>
      </div>
    </section>
  );
}

