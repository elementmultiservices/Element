import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { signOutAction } from "@/actions/auth";
import { FormAlert } from "@/components/forms/form-alert";
import { AuthCard } from "@/components/layout/auth-card";
import { redirect } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { homePathFor, requireSession } from "@/lib/auth/session";
import { pageMetadata } from "@/lib/seo";
import { MfaEnroll, MfaVerify } from "./mfa-forms";

export async function generateMetadata({ params }: PageProps<"/[locale]/mfa">): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata({ locale: toLocale(locale), path: "/mfa", page: "mfa", noIndex: true });
}

export default async function MfaPage({ params }: PageProps<"/[locale]/mfa">) {
  const { locale } = await params;
  setRequestLocale(toLocale(locale));
  const session = await requireSession();
  const t = await getTranslations("Auth.mfa");

  if (session.hasVerifiedMfa && session.aal === "aal2") {
    redirect({ href: homePathFor(session.role), locale: toLocale(locale) });
  }

  const enrolling = !session.hasVerifiedMfa;

  return (
    <AuthCard title={enrolling ? t("enrollTitle") : t("verifyTitle")} subtitle={enrolling ? t("enrollBody") : t("verifyBody")}>
      {enrolling && session.role === "admin" ? (
        <FormAlert variant="info" className="mb-5">
          {t("requiredForAdmins")}
        </FormAlert>
      ) : null}
      {enrolling ? <MfaEnroll /> : <MfaVerify />}
      <form action={signOutAction} className="mt-6 border-t pt-4">
        <button type="submit" className="text-sm text-link hover:underline">
          {t("useAnotherAccount")}
        </button>
      </form>
    </AuthCard>
  );
}
