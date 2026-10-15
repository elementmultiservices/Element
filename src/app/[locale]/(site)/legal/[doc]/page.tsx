import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FileText } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHero } from "@/components/marketing/page-hero";
import { Link } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { pageMetadata } from "@/lib/seo";
import { getSiteContact } from "@/lib/site-settings";
import { cn } from "@/lib/utils";

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
  const [t, tf, contact] = await Promise.all([getTranslations("Legal"), getTranslations("Footer"), getSiteContact()]);

  // The documents name the office's current details from the business settings.
  const reach = contact.email ? t("contactWithEmail", { phone: contact.phone, email: contact.email }) : t("contactPhoneOnly", { phone: contact.phone });
  const fill = (text: string) => text.replaceAll("{address}", contact.address).replaceAll("{phone}", contact.phone).replaceAll("{contact}", reach);

  const sections = t.raw(`${key}.sections`) as Section[];
  const rows = key === "cookies" ? (t.raw("cookies.rows") as CookieRow[]) : [];
  const th = "px-4 py-3 text-left font-mono text-[11px] font-medium tracking-[0.08em] whitespace-nowrap text-graphite uppercase";

  return (
    <>
      <PageHero eyebrow={tf("legalHeading")} title={t(`${key}.title`)} body={t("lastUpdated", { date: t("updatedDate") })} />

      <div className="mx-auto grid max-w-[1240px] gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[260px_1fr] lg:gap-16 lg:py-20">
        <nav aria-label={t("otherDocuments")} className="lg:sticky lg:top-32 lg:self-start">
          <h2 className="font-mono text-xs font-normal tracking-[0.1em] text-graphite uppercase">{t("otherDocuments")}</h2>
          <ul className="mt-4 flex flex-wrap gap-2 lg:flex-col">
            {(Object.keys(DOCS) as DocSlug[]).map((d) => {
              const active = d === doc;
              return (
                <li key={d}>
                  <Link
                    href={`/legal/${d}`}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors",
                      active ? "bg-ink text-white" : "bg-azure-25 text-ink hover:bg-azure-50",
                    )}
                  >
                    <FileText aria-hidden="true" className={cn("size-4 shrink-0", active ? "text-azure-300" : "text-cobalt")} />
                    {tf(DOCS[d])}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="min-w-0 max-w-3xl">
          <div className="prose-element">
            <p className="text-lg text-graphite">{fill(t.raw(`${key}.intro`) as string)}</p>
            {sections.map((section) => (
              <section key={section.heading}>
                <h2>{section.heading}</h2>
                {section.body.map((paragraph, i) => (
                  <p key={i}>{fill(paragraph)}</p>
                ))}
              </section>
            ))}
          </div>

          {rows.length > 0 ? (
            <section className="mt-12">
              <h2 className="text-2xl font-semibold text-ink">{t("cookies.tableHeading")}</h2>
              <div className="relative mt-5 overflow-x-auto rounded-[20px] border border-azure-50 bg-white">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="border-b border-azure-50 bg-mist">
                    <tr>
                      <th scope="col" className={th}>{t("cookieTable.name")}</th>
                      <th scope="col" className={th}>{t("cookieTable.purpose")}</th>
                      <th scope="col" className={th}>{t("cookieTable.duration")}</th>
                      <th scope="col" className={th}>{t("cookieTable.type")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-azure-50">
                    {rows.map((row) => (
                      <tr key={row.name} className="align-top">
                        <td className="px-4 py-3.5 font-mono text-xs text-ink">{row.name}</td>
                        <td className="px-4 py-3.5 text-ink">{row.purpose}</td>
                        <td className="px-4 py-3.5 text-graphite">{row.duration}</td>
                        <td className="px-4 py-3.5 text-graphite">{row.type}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </>
  );
}
