import type { Metadata } from "next";
import { Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { stagger } from "@/components/marketing/motion";
import { PageHero } from "@/components/marketing/page-hero";
import { SmartLink } from "@/components/marketing/smart-link";
import { Button } from "@/components/ui/button";
import { toLocale } from "@/i18n/routing";
import { getSiteContact } from "@/lib/site-settings";
import { issueFormToken } from "@/lib/security/form-token";
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
  const contact = await getSiteContact();
  const formToken = await issueFormToken("contact");
  const details = [
    { icon: MapPin, text: contact.address },
    { icon: Phone, text: contact.phone },
    { icon: Mail, text: contact.email },
    { icon: Clock, text: contact.hoursRegular.join(" · ") },
  ].filter((d) => d.text);

  return (
    <>
      <PageHero eyebrow={t("Footer.contactHeading")} title={t("Contact.title")} body={t("Contact.description")} />
      <div className="mx-auto grid max-w-[1240px] gap-4 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_380px] lg:py-24">
        <section aria-labelledby="contact-form-heading" className="reveal rounded-[28px] border border-azure-50 bg-white p-6 sm:p-10 lg:rounded-[36px]">
          <h2 id="contact-form-heading" className="text-2xl font-semibold text-ink sm:text-[28px]">
            {t("Contact.formHeading")}
          </h2>
          <div className="mt-8">
            <ContactForm formToken={formToken} />
          </div>
        </section>
        <aside
          aria-labelledby="contact-details-heading"
          style={stagger(1)}
          className="reveal relative flex h-fit flex-col gap-6 overflow-hidden rounded-[28px] bg-[linear-gradient(160deg,#050D29_0%,#13295A_60%,#2B56B3_100%)] p-7 text-white lg:sticky lg:top-32 lg:rounded-[36px]"
        >
          <span aria-hidden="true" className="motion-float absolute -right-16 -bottom-20 size-60 rounded-full bg-sky/25 blur-3xl" />
          <h2 id="contact-details-heading" className="relative text-2xl font-semibold text-white">
            {t("Contact.detailsHeading")}
          </h2>
          <ul className="relative flex flex-col gap-4 text-[15px]">
            {details.map(({ icon: Icon, text }) => (
              <li key={text} className="flex gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10">
                  <Icon aria-hidden="true" className="size-4 text-azure-300" />
                </span>
                <span className="pt-1.5 text-azure-50">{text}</span>
              </li>
            ))}
          </ul>
          <Button asChild size="pill" className="relative bg-white text-ink hover:bg-azure-25">
            <SmartLink href={contact.whatsappHref}>
              <MessageCircle aria-hidden="true" />
              {t("Nav.whatsapp")}
            </SmartLink>
          </Button>
        </aside>
      </div>
    </>
  );
}
