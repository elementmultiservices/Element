import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { IntakeForm } from "@/components/intake/intake-form";
import { container } from "@/components/marketing/section-intro";
import { clientMessages } from "@/i18n/client-messages";
import { redirect } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { NEXT_TARGETS } from "@/lib/auth/next-target";
import { authorize } from "@/lib/auth/session";
import { taxYearOptions } from "@/lib/intake/schema";
import { issueDraftToken } from "@/lib/security/form-token";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/intake">): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata({ locale: toLocale(locale), path: "/intake", page: "intake", noIndex: true });
}

/**
 * Public intake form: no account needed. Each page view gets a fresh draft
 * token (identity of the visitor's pending documents and time trap). Signed-in
 * clients use the form in their account instead, so it is theirs right away.
 */
export default async function PublicIntakePage({ params }: PageProps<"/[locale]/intake">) {
  const { locale: rawLocale } = await params;
  const locale = toLocale(rawLocale);
  setRequestLocale(locale);
  const auth = await authorize();
  if (auth.ok && auth.ctx.role === "user") redirect({ href: NEXT_TARGETS.intake, locale });

  const t = await getTranslations();
  const draftToken = await issueDraftToken();

  return (
    <section aria-labelledby="intake-title" className={`${container} flex flex-col gap-6 pt-10 pb-16 lg:pt-14 lg:pb-24`}>
      <div className="flex max-w-3xl flex-col gap-3">
        <h1 id="intake-title" className="text-[36px] leading-[1.05] font-semibold tracking-[-0.02em] text-ink sm:text-5xl">
          {t("Intake.new.title")}
        </h1>
        <p className="text-base leading-relaxed text-graphite">{t("Intake.public.description")}</p>
      </div>
      <div className="w-full">
        <NextIntlClientProvider messages={await clientMessages("Intake")}>
          <IntakeForm taxYears={taxYearOptions()} defaults={{ firstName: "", lastName: "", email: "" }} draftToken={draftToken} />
        </NextIntlClientProvider>
        <p className="mt-4 text-xs text-muted-foreground">{t("Auth.recaptchaNotice")}</p>
      </div>
    </section>
  );
}
