import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { z } from "zod";
import { StatusView } from "@/components/states/status-view";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { pageMetadata } from "@/lib/seo";
import { UnsubscribeForm } from "./unsubscribe-form";

export async function generateMetadata({ params }: PageProps<"/[locale]/newsletter/unsubscribe">): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata({ locale: toLocale(locale), path: "/newsletter/unsubscribe", page: "unsubscribe", noIndex: true });
}

/** Landing page of the unsubscribe link: asks for one click (link scanners must not unsubscribe people). */
export default async function UnsubscribePage({ params, searchParams }: PageProps<"/[locale]/newsletter/unsubscribe">) {
  const { locale } = await params;
  setRequestLocale(toLocale(locale));
  const t = await getTranslations("Newsletter.unsubscribe");
  const { token } = await searchParams;
  const valid = z.uuid().safeParse(token);

  if (!valid.success) {
    const te = await getTranslations("Errors");
    return (
      <StatusView title={t("title")} body={te("linkInvalid")}>
        <Button asChild variant="outline-brand" size="pill-lg">
          <Link href="/">{t("home")}</Link>
        </Button>
      </StatusView>
    );
  }

  return (
    <StatusView title={t("title")} body={t("body")}>
      <UnsubscribeForm token={valid.data} />
    </StatusView>
  );
}
