import { getTranslations } from "next-intl/server";
import { Wordmark } from "@/components/brand/wordmark";
import { Link } from "@/i18n/navigation";
import { legalNav, publicNav } from "./site-nav";

export async function SiteFooter() {
  const t = await getTranslations();
  const year = new Date().getFullYear();
  const linkClass = "text-primary-foreground/80 hover:text-primary-foreground hover:underline";

  return (
    <footer className="mt-auto bg-primary text-primary-foreground">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div>
          <Wordmark inverted />
          <p className="mt-3 text-sm text-primary-foreground/80">{t("Footer.tagline")}</p>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-primary-foreground">{t("Footer.siteHeading")}</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {publicNav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={linkClass}>
                  {t(`Nav.${item.key}`)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-primary-foreground">{t("Footer.contactHeading")}</h2>
          <address className="mt-3 space-y-2 text-sm not-italic text-primary-foreground/80">
            <p>{t("Footer.address")}</p>
            <p>{t("Footer.phone")}</p>
            <p>{t("Footer.email")}</p>
            <p>{t("Footer.hours")}</p>
          </address>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-primary-foreground">{t("Footer.legalHeading")}</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {legalNav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={linkClass}>
                  {t(`Footer.${item.key}`)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-primary-foreground/15">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4 text-xs text-primary-foreground/70 sm:flex-row sm:justify-between sm:px-6">
          <p>{t("Footer.rights", { year })}</p>
          <p>{t("Footer.placeholderNotice")}</p>
        </div>
      </div>
    </footer>
  );
}
