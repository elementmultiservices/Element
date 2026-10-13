import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthDivider, GoogleButton } from "@/components/auth/google-button";
import { AuthCard } from "@/components/layout/auth-card";
import { Link } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { pageMetadata } from "@/lib/seo";
import { SignInForm } from "./sign-in-form";

export async function generateMetadata({ params }: PageProps<"/[locale]/sign-in">): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata({ locale: toLocale(locale), path: "/sign-in", page: "signIn", noIndex: true });
}

export default async function SignInPage({ params, searchParams }: PageProps<"/[locale]/sign-in">) {
  const { locale } = await params;
  setRequestLocale(toLocale(locale));
  const { reason } = await searchParams;
  const t = await getTranslations("Auth.signIn");

  const notices = {
    session_ended: "sessionEnded",
    password_updated: "passwordUpdated",
    mfa_reset: "mfaReset",
    oauth_failed: "oauthFailed",
  } as const;
  const notice = typeof reason === "string" && Object.hasOwn(notices, reason) ? notices[reason as keyof typeof notices] : undefined;

  return (
    <AuthCard title={t("title")} subtitle={t("subtitle")}>
      <GoogleButton />
      <AuthDivider />
      <SignInForm notice={notice} />
      <p className="mt-8 border-t border-azure-50 pt-5 text-sm text-graphite">
        {t("noAccount")}{" "}
        <Link href="/sign-up" className="font-semibold text-electric hover:underline">
          {t("createAccount")}
        </Link>
      </p>
    </AuthCard>
  );
}
