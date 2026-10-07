"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Menu } from "lucide-react";
import { Wordmark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Link } from "@/i18n/navigation";
import { publicNav } from "./site-nav";

export function MobileNav({ accountHref, accountLabel }: { accountHref: string; accountLabel: string }) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu aria-hidden="true" />
          <span className="sr-only">{t("Common.openMenu")}</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" closeLabel={t("Common.close")} className="w-72">
        <SheetTitle className="px-4 pt-4">
          <Wordmark />
        </SheetTitle>
        <nav aria-label={t("Nav.main")} className="flex flex-col gap-1 px-2 pt-4">
          {publicNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
            >
              {t(`Nav.${item.key}`)}
            </Link>
          ))}
          <Link
            href={accountHref}
            onClick={() => setOpen(false)}
            className="mt-3 rounded-md bg-primary px-3 py-2 text-center text-sm font-medium text-primary-foreground hover:bg-primary-hover"
          >
            {accountLabel}
          </Link>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
