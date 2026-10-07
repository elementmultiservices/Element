import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { pageMetadata } from "@/lib/seo";

const DOCS = {
  privacy: "privacy",
  "data-policy": "dataPolicy",
  terms: "terms",
  cookies: "cookies",
} as const;
type DocSlug = keyof typeof DOCS;
type DocKey = (typeof DOCS)[DocSlug];

type Section = { heading: string; body: string[] };
type CookieRow = { name: string; purpose: string; duration: string; type: string };

function isDoc(v: string): v is DocSlug {
  return Object.hasOwn(DOCS, v);
}

export function generateStaticParams() {
  return Object.keys(DOCS).map((doc) => ({ doc }));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/legal/[doc]">): Promise<Metadata> {
  const { locale, doc } = await params;
  if (!isDoc(doc)) return {};
  return pageMetadata({ locale: toLocale(locale), path: `/legal/${doc}`, page: DOCS[doc], descriptionKey: "legal" });
}

export default async function LegalPage({ params }: PageProps<"/[locale]/legal/[doc]">) {
  const { locale, doc } = await params;
  setRequestLocale(toLocale(locale));
  if (!isDoc(doc)) notFound();
  const key: DocKey = DOCS[doc];
  const t = await getTranslations("Legal");
  const tf = await getTranslations("Footer");

  const sections = t.raw(`${key}.sections`) as Section[];
  const rows = key === "cookies" ? (t.raw("cookies.rows") as CookieRow[]) : [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div role="note" className="flex gap-3 rounded-md border border-warning/40 bg-warning-bg px-4 py-3 text-sm text-warning">
        <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <p className="font-medium">{t("reviewBanner")}</p>
      </div>
      <h1 className="mt-8 text-3xl sm:text-4xl">{t(`${key}.title`)}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("lastUpdated", { date: t("updatedDate") })}</p>
      <div className="prose-element mt-8">
        <p>{t(`${key}.intro`)}</p>
        {sections.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            {section.body.map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </section>
        ))}
      </div>

      {rows.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-xl">{t("cookies.tableHeading")}</h2>
          <div className="relative mt-4 overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="border-b bg-surface">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left font-semibold">{t("cookieTable.name")}</th>
                  <th scope="col" className="px-3 py-2 text-left font-semibold">{t("cookieTable.purpose")}</th>
                  <th scope="col" className="px-3 py-2 text-left font-semibold">{t("cookieTable.duration")}</th>
                  <th scope="col" className="px-3 py-2 text-left font-semibold">{t("cookieTable.type")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => (
                  <tr key={row.name} className="align-top">
                    <td className="px-3 py-2 font-mono text-xs">{row.name}</td>
                    <td className="px-3 py-2">{row.purpose}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.duration}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <nav aria-label={t("otherDocuments")} className="mt-12 border-t pt-6">
        <h2 className="text-sm font-semibold">{t("otherDocuments")}</h2>
        <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {(Object.keys(DOCS) as DocSlug[])
            .filter((d) => d !== doc)
            .map((d) => (
              <li key={d}>
                <Link href={`/legal/${d}`} className="text-link hover:underline">
                  {tf(DOCS[d])}
                </Link>
              </li>
            ))}
        </ul>
      </nav>
    </div>
  );
}
