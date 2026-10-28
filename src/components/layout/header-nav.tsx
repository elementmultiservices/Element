"use client";

import { useTranslations } from "next-intl";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import { StateRefundDialog } from "@/components/marketing/state-refund-dialog";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { IRS_REFUND_URL, isActivePath, publicNav, REFUND_STATUS_ID } from "./site-nav";

const MENU_ITEM_CLASS =
  "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] font-medium text-ink transition-colors hover:bg-azure-25 hover:text-electric";

/** Desktop navigation; highlights the section the visitor is in. */
export function HeaderNav() {
  const t = useTranslations("Nav");
  const pathname = usePathname();

  return (
    <nav aria-label={t("main")} className="hidden items-center gap-7 lg:flex">
      {publicNav.map((item) => {
        if (item.key === "refund") {
          return (
            <div key={item.href} className="group relative">
              <Link
                href={item.href}
                onClick={(e) => openRefundStatus(e, pathname)}
                className="inline-flex items-center gap-1 rounded-sm text-[15px] font-medium text-ink transition-colors hover:text-electric"
              >
                {t(item.key)}
                <ChevronDown
                  aria-hidden="true"
                  className="size-4 transition-transform group-hover:rotate-180 group-focus-within:rotate-180"
                />
              </Link>
              {/* pt-3 bridges the gap so the menu stays open while the pointer moves down. */}
              <div className="invisible absolute top-full left-1/2 z-50 -translate-x-1/2 pt-3 opacity-0 transition-opacity duration-200 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                <ul className="flex w-60 flex-col gap-1 rounded-2xl border border-azure-50 bg-white p-2 shadow-[0_18px_40px_rgba(5,13,41,0.1)]">
                  <li>
                    <a href={IRS_REFUND_URL} target="_blank" rel="noopener noreferrer" className={MENU_ITEM_CLASS}>
                      {t("refundFederal")}
                      <ArrowUpRight aria-hidden="true" className="size-4" />
                    </a>
                  </li>
                  <li>
                    <StateRefundDialog triggerClassName={MENU_ITEM_CLASS} label={t("refundState")} />
                  </li>
                </ul>
              </div>
            </div>
          );
        }
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

/**
 * Already on the FAQ: client-side navigation would not fire `hashchange`, so set
 * the hash natively; the accordion then opens the refund-status answer.
 */
export function openRefundStatus(e: React.MouseEvent, pathname: string) {
  if (!isActivePath(pathname, "/faq")) return;
  e.preventDefault();
  if (window.location.hash === `#${REFUND_STATUS_ID}`) {
    document.getElementById(REFUND_STATUS_ID)?.scrollIntoView({ behavior: "smooth" });
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  } else {
    window.location.hash = REFUND_STATUS_ID;
  }
}
