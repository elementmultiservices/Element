import { cookies } from "next/headers";
import { setRequestLocale } from "next-intl/server";
import { toLocale } from "@/i18n/routing";
import { CookieNotice } from "@/components/layout/cookie-notice";
import { COOKIE_NOTICE_NAME } from "@/lib/cookie-notice";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

export default async function SiteLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(toLocale(locale));
  const noticeSeen = (await cookies()).get(COOKIE_NOTICE_NAME)?.value === "1";

  return (
    <>
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>
      <SiteFooter />
      <CookieNotice initiallyVisible={!noticeSeen} />
    </>
  );
}
