import { getTranslations } from "next-intl/server";
import { Wordmark } from "@/components/brand/wordmark";
import { Link } from "@/i18n/navigation";
import { getSiteContact } from "@/lib/site-settings";
import { footerServicesNav, footerSiteNav, legalNav } from "./site-nav";

export async function SiteFooter() {
  const t = await getTranslations();
  const contact = await getSiteContact();
  const year = new Date().getFullYear();
  const linkClass = "rounded-sm text-azure-100 transition-colors hover:text-white hover:underline";
  const headingClass = "font-mono text-xs font-normal tracking-[0.1em] text-azure-300 uppercase";

  return (
    <footer className="mt-auto bg-ink pb-[76px] text-white md:pb-0">
      <div className="mx-auto grid max-w-[1240px] grid-cols-2 gap-10 px-4 pt-16 pb-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
        <div className="col-span-2 md:col-span-1">
          <Wordmark inverted />
          <p className="mt-5 max-w-xs text-2xl leading-tight font-semibold text-white">{t("Footer.tagline")}</p>
        </div>
        <div>
          <h2 className={headingClass}>{t("Footer.servicesHeading")}</h2>
          <ul className="mt-4 space-y-2.5 text-[15px]">
            {footerServicesNav.map((key) => (
              <li key={key}>
                <Link href={`/services#${key}`} className={linkClass}>
                  {t(`Footer.services.${key}`)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className={headingClass}>{t("Footer.elementHeading")}</h2>
          <ul className="mt-4 space-y-2.5 text-[15px]">
            <li>
              <Link href="/dashboard" className={linkClass}>
                {t("Nav.myFiles")}
              </Link>
            </li>
            {footerSiteNav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={linkClass}>
                  {t(`Nav.${item.key}`)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="col-span-2 md:col-span-1">
          <h2 className={headingClass}>{t("Footer.contactHeading")}</h2>
          <address className="mt-4 space-y-2.5 text-[15px] not-italic text-azure-100">
            {contact.address ? <p>{contact.address}</p> : null}
            {contact.phone ? (
              <p>
                <a href={contact.phoneHref} className={linkClass}>
                  {contact.phone}
                </a>
              </p>
            ) : null}
            {contact.email ? (
              <p>
                <a href={`mailto:${contact.email}`} className={linkClass}>
                  {contact.email}
                </a>
              </p>
            ) : null}
          </address>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto max-w-[1240px] space-y-3 px-4 py-8 text-xs leading-relaxed text-azure-100/80 sm:px-6">
          <p>{t("Footer.disclaimer")}</p>
          <p>{t("Footer.immigrationNotice")}</p>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-3 px-4 py-5 text-xs text-azure-100/80 sm:px-6 md:flex-row md:items-center md:justify-between">
          <p>{t("Footer.rights", { year })}</p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
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
    </footer>
  );
}
