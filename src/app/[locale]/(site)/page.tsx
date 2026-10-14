import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Faq } from "@/components/home/faq";
import { FinalCta } from "@/components/home/final-cta";
import { Hero } from "@/components/home/hero";
import { LatestNews } from "@/components/home/latest-news";
import { Location } from "@/components/home/location";
import { QuickAccess } from "@/components/home/quick-access";
import { Services } from "@/components/home/services";
import { Stats, Steps } from "@/components/home/stats-and-steps";
import { Testimonials } from "@/components/home/testimonials";
import { Vault } from "@/components/home/vault";
import { WhyElement } from "@/components/home/why-element";
import { toLocale } from "@/i18n/routing";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata({ locale: toLocale(locale), path: "/", page: "home" });
}

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale: rawLocale } = await params;
  const locale = toLocale(rawLocale);
  setRequestLocale(locale);

  return (
    <>
      <Hero />
      <QuickAccess />
      <WhyElement />
      <Vault />
      <Stats />
      <Steps />
      <Services />
      <Location />
      <Testimonials />
      <LatestNews locale={locale} />
      <Faq />
      <FinalCta />
    </>
  );
}
