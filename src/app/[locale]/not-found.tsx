import { getTranslations } from "next-intl/server";
import { MobileActionBar } from "@/components/layout/mobile-action-bar";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { StatusView } from "@/components/states/status-view";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations();
  return (
    <>
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
        <StatusView code={t("NotFound.code")} title={t("NotFound.title")} body={t("NotFound.body")}>
          <Button asChild variant="brand" size="pill-lg">
            <Link href="/">{t("NotFound.backHome")}</Link>
          </Button>
          <Button asChild variant="outline-brand" size="pill-lg">
            <Link href="/services">{t("Nav.services")}</Link>
          </Button>
        </StatusView>
      </main>
      <SiteFooter />
      <MobileActionBar />
    </>
  );
}
