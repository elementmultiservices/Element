import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/about">): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata({ locale: toLocale(locale), path: "/about", page: "about", descriptionKey: "about" });
}

export default async function AboutPage({ params }: PageProps<"/[locale]/about">) {
  const { locale } = await params;
  setRequestLocale(toLocale(locale));
  const t = await getTranslations("About");
  const sections = ["mission", "approach", "commitment"] as const;
  const values = ["confidentiality", "traceability", "availability", "service"] as const;

  return (
    <>
      <section className="border-b bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <p className="text-sm font-medium tracking-wide text-link uppercase">{t("eyebrow")}</p>
          <h1 className="mt-3 max-w-3xl text-3xl sm:text-4xl">{t("title")}</h1>
          <p className="mt-5 max-w-3xl text-lg text-muted-foreground">{t("intro")}</p>
        </div>
      </section>
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-6 md:grid-cols-3">
          {sections.map((key) => (
            <section key={key} className="rounded-lg border bg-card p-6">
              <h2 className="text-xl">{t(`sections.${key}.title`)}</h2>
              <p className="mt-3 text-muted-foreground">{t(`sections.${key}.body`)}</p>
            </section>
          ))}
        </div>
        <section className="mt-12 max-w-3xl">
          <h2 className="text-2xl">{t("valuesHeading")}</h2>
          <ul className="mt-5 space-y-3">
            {values.map((key) => (
              <li key={key} className="flex gap-3">
                <CheckCircle2 aria-hidden="true" className="mt-1 size-5 shrink-0 text-link" />
                <span>{t(`values.${key}`)}</span>
              </li>
            ))}
          </ul>
          <Button asChild className="mt-8">
            <Link href="/contact">{t("contactCta")}</Link>
          </Button>
        </section>
        <p className="mt-12 text-xs text-muted-foreground">{t("placeholderNotice")}</p>
      </div>
    </>
  );
}
