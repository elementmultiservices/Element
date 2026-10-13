"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { isActivePath, publicNav } from "./site-nav";

/** Desktop navigation; highlights the section the visitor is in. */
export function HeaderNav() {
  const t = useTranslations("Nav");
  const pathname = usePathname();

  return (
    <nav aria-label={t("main")} className="hidden items-center gap-7 lg:flex">
      {publicNav.map((item) => {
        const active = isActivePath(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-sm text-[15px] font-medium transition-colors hover:text-electric",
              active ? "text-electric" : "text-ink",
            )}
          >
            {t(item.key)}
          </Link>
        );
      })}
    </nav>
  );
}
