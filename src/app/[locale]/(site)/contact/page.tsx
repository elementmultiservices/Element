import type { Metadata } from "next";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { toLocale } from "@/i18n/routing";
import { pageMetadata } from "@/lib/seo";
import { ContactForm } from "./contact-form";

export async function generateMetadata({ params }: PageProps<"/[locale]/contact">): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata({ locale: toLocale(locale), path: "/contact", page: "contact", descriptionKey: "contact" });
}

export default async function ContactPage({ params }: PageProps<"/[locale]/contact">) {
  const { locale } = await params;
  setRequestLocale(toLocale(locale));
  const t = await getTranslations();
  const details = [
    { icon: MapPin, text: t("Footer.address") },
    { icon: Phone, text: t("Footer.phone") },
    { icon: Mail, text: t("Footer.email") },
    { icon: Clock, text: t("Footer.hours") },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <header className="max-w-3xl">
        <h1 className="text-3xl sm:text-4xl">{t("Contact.title")}</h1>
        <p className="mt-3 text-lg text-muted-foreground">{t("Contact.description")}</p>
      </header>
      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_20rem]">
        <section aria-labelledby="contact-form-heading" className="rounded-lg border bg-card p-6 sm:p-8">
          <h2 id="contact-form-heading" className="text-xl">
            {t("Contact.formHeading")}
          </h2>
          <div className="mt-6">
            <ContactForm />
          </div>
        </section>
        <aside aria-labelledby="contact-details-heading" className="h-fit rounded-lg border bg-surface p-6">
          <h2 id="contact-details-heading" className="text-lg">
            {t("Contact.detailsHeading")}
          </h2>
          <ul className="mt-4 space-y-3 text-sm">
            {details.map(({ icon: Icon, text }) => (
              <li key={text} className="flex gap-3">
                <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-link" />
                <span>{text}</span>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-xs text-muted-foreground">{t("Footer.placeholderNotice")}</p>
        </aside>
      </div>
    </div>
  );
}
