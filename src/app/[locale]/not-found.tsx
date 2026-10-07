import { getTranslations } from "next-intl/server";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("NotFound");
  return (
    <>
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
        <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
          <p className="text-sm font-medium text-link">{t("code")}</p>
          <h1 className="mt-2 text-3xl">{t("title")}</h1>
          <p className="mt-4 text-muted-foreground">{t("body")}</p>
          <Button asChild className="mt-8">
            <Link href="/">{t("backHome")}</Link>
          </Button>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
