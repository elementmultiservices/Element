import { getTranslations } from "next-intl/server";
import { Wordmark } from "@/components/brand/wordmark";
import { NewsletterForm } from "@/components/newsletter/newsletter-form";
import { Link } from "@/i18n/navigation";
import { issueFormToken } from "@/lib/security/form-token";
import { getSiteContact } from "@/lib/site-settings";
import { footerServicesNav, footerSiteNav, legalNav } from "./site-nav";

export async function SiteFooter() {
  const t = await getTranslations();
  const contact = await getSiteContact();
  const newsletterToken = await issueFormToken("newsletter");
  const year = new Date().getFullYear();
  const linkClass = "rounded-sm text-azure-100 transition-colors hover:text-white hover:underline";
  const headingClass = "font-mono text-xs font-normal tracking-[0.1em] text-azure-300 uppercase";

  return (
    <footer className="mt-auto bg-ink pb-[76px] text-white md:pb-0">
      <section aria-labelledby="footer-newsletter" className="border-b border-white/10">
        <div className="mx-auto grid max-w-[1240px] items-center gap-6 px-4 py-10 sm:px-6 md:grid-cols-[1fr_minmax(0,460px)] md:gap-12 lg:py-12">
          <div className="flex flex-col gap-2">
            <h2 id="footer-newsletter" className="text-2xl leading-tight font-semibold text-white sm:text-[28px]">
              {t("Newsletter.footer.title")}
            </h2>
            <p className="text-[15px] text-azure-100">{t("Newsletter.footer.body")}</p>
          </div>
          <NewsletterForm formToken={newsletterToken} source="footer" />
        </div>
      </section>
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
