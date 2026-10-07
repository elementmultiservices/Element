import { getTranslations } from "next-intl/server";
import { Wordmark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getSessionContext, homePathFor } from "@/lib/auth/session";
import { LanguageSwitcher } from "./language-switcher";
import { MobileNav } from "./mobile-nav";
import { publicNav } from "./site-nav";

export async function SiteHeader() {
  const t = await getTranslations();
  const session = await getSessionContext();
  const accountHref = session ? homePathFor(session.role) : "/sign-in";
  const accountLabel = session ? t("Common.myPanel") : t("Common.signIn");

  return (
    <header className="sticky top-0 z-40 border-b bg-background">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="rounded-sm" aria-label={t("Common.home")}>
          <Wordmark />
        </Link>
        <nav aria-label={t("Nav.main")} className="hidden items-center gap-1 md:flex">
          {publicNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-accent hover:text-primary"
            >
              {t(`Nav.${item.key}`)}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1.5">
          <LanguageSwitcher />
          <Button asChild size="sm" className="hidden md:inline-flex">
            <Link href={accountHref}>{accountLabel}</Link>
          </Button>
          <MobileNav accountHref={accountHref} accountLabel={accountLabel} />
        </div>
      </div>
    </header>
  );
}
