import { getTranslations } from "next-intl/server";
import { ArrowRight, UserRound } from "lucide-react";
import { Wordmark } from "@/components/brand/wordmark";
import { SmartLink } from "@/components/marketing/smart-link";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getSessionContext, homePathFor } from "@/lib/auth/session";
import { getSiteContact } from "@/lib/site-settings";
import { HeaderNav } from "./header-nav";
import { LanguageSwitcher } from "./language-switcher";
import { MobileNav } from "./mobile-nav";

export async function SiteHeader() {
  const t = await getTranslations();
  const contact = await getSiteContact();
  const session = await getSessionContext();
  const accountHref = session ? homePathFor(session.role) : "/sign-in";
  const accountLabel = session ? t("Common.myPanel") : t("Common.signIn");

  return (
    <>
      {contact.announcement ? (
        <div className="bg-ink px-4 py-2.5 text-sm sm:px-6">
          <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-center gap-x-4 gap-y-1 text-center">
            {contact.announcement.label ? (
              <span className="font-mono text-xs tracking-[0.08em] text-azure-300">{contact.announcement.label}</span>
            ) : null}
            <span className="text-azure-50">{contact.announcement.text}</span>
            <SmartLink
              href={contact.bookingHref}
              className="inline-flex items-center gap-1 rounded-sm font-semibold text-white hover:underline"
            >
              {t("Home.announcement.cta")}
              <ArrowRight aria-hidden="true" className="size-3.5" />
            </SmartLink>
          </div>
        </div>
      ) : null}
      <header className="header-raise sticky top-0 z-40 border-b border-azure-50 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-[72px] max-w-[1240px] items-center justify-between gap-4 px-4 sm:px-6 lg:h-[84px]">
          <Link href="/" className="rounded-sm" aria-label={t("Common.home")}>
            <Wordmark />
          </Link>
          <HeaderNav />
          <div className="flex items-center gap-2.5">
            <LanguageSwitcher variant="inline" className="hidden lg:flex" />
            <Button asChild variant="outline-brand" size="pill" className="hidden md:inline-flex">
              <Link href={accountHref}>
                <UserRound aria-hidden="true" />
                {accountLabel}
              </Link>
            </Button>
            <Button asChild variant="brand" size="pill" className="px-4 sm:px-[22px]">
              <SmartLink href={contact.bookingHref}>
                <span className="sm:hidden">{t("Nav.bookShort")}</span>
                <span className="hidden sm:inline">{t("Nav.book")}</span>
              </SmartLink>
            </Button>
            <MobileNav accountHref={accountHref} accountLabel={accountLabel} />
          </div>
        </div>
      </header>
    </>
  );
}
