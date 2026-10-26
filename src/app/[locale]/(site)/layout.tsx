import { cookies } from "next/headers";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { toLocale } from "@/i18n/routing";
import { publicEnv } from "@/lib/public-env";
import { getSiteContact } from "@/lib/site-settings";
import { jsonLdHtml, localBusinessJsonLd } from "@/lib/structured-data";
import { CookieNotice } from "@/components/layout/cookie-notice";
import { COOKIE_NOTICE_NAME } from "@/lib/cookie-notice";
import { MobileActionBar } from "@/components/layout/mobile-action-bar";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { SmoothScroll } from "@/components/layout/smooth-scroll";

export default async function SiteLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(toLocale(locale));
  const noticeSeen = (await cookies()).get(COOKIE_NOTICE_NAME)?.value === "1";
  const [contact, t] = await Promise.all([getSiteContact(), getTranslations("Metadata")]);
  const business = localBusinessJsonLd({
    contact,
    name: t("siteName"),
    alternateName: "Element Multiservices",
    description: t("description"),
    url: publicEnv.siteUrl,
  });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(business) }} />
      <SmoothScroll />
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>
      <SiteFooter />
      <MobileActionBar />
      <CookieNotice initiallyVisible={!noticeSeen} />
    </>
  );
}
