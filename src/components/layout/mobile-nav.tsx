"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowUpRight, Menu, UserRound } from "lucide-react";
import { Wordmark } from "@/components/brand/wordmark";
import { StateRefundDialog } from "@/components/marketing/state-refund-dialog";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { LanguageSwitcher } from "./language-switcher";
import { openRefundStatus } from "./header-nav";
import { IRS_REFUND_URL, isActivePath, publicNav } from "./site-nav";

const SUB_ITEM_CLASS =
  "flex w-full items-center justify-between gap-3 rounded-xl py-2.5 pr-3 pl-7 text-left text-[15px] font-medium text-graphite hover:bg-azure-25 hover:text-electric";

export function MobileNav({ accountHref, accountLabel }: { accountHref: string; accountLabel: string }) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon-lg" className="rounded-full text-ink lg:hidden">
          <Menu aria-hidden="true" className="size-5" />
          <span className="sr-only">{t("Common.openMenu")}</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" closeLabel={t("Common.close")} className="w-80">
        <SheetTitle className="px-5 pt-5">
          <Wordmark />
        </SheetTitle>
        <nav aria-label={t("Nav.main")} className="flex flex-col gap-1 px-3 pt-6">
          {publicNav.map((item) =>
            item.key === "refund" ? (
              <div key={item.href} className="flex flex-col">
                <Link
                  href={item.href}
                  onClick={(e) => {
                    openRefundStatus(e, pathname);
                    setOpen(false);
                  }}
                  className="rounded-xl px-3 py-3 text-base font-medium text-ink hover:bg-azure-25"
                >
                  {t(`Nav.${item.key}`)}
                </Link>
                <a href={IRS_REFUND_URL} target="_blank" rel="noopener noreferrer" className={SUB_ITEM_CLASS}>
                  {t("Nav.refundFederal")}
                  <ArrowUpRight aria-hidden="true" className="size-4" />
                </a>
                <StateRefundDialog triggerClassName={SUB_ITEM_CLASS} label={t("Nav.refundState")} />
              </div>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={isActivePath(pathname, item.href) ? "page" : undefined}
                className={cn(
                  "rounded-xl px-3 py-3 text-base font-medium hover:bg-azure-25",
                  isActivePath(pathname, item.href) ? "bg-azure-25 text-electric" : "text-ink",
                )}
              >
                {t(`Nav.${item.key}`)}
              </Link>
            ),
          )}
          <Link
            href={accountHref}
            onClick={() => setOpen(false)}
            className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-azure-100 px-5 text-[15px] font-semibold text-ink hover:bg-azure-25"
          >
            <UserRound aria-hidden="true" className="size-4" />
            {accountLabel}
          </Link>
          <LanguageSwitcher variant="inline" className="mt-4 justify-center" />
        </nav>
      </SheetContent>
    </Sheet>
  );
}
