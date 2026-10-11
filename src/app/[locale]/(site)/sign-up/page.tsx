import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthDivider, GoogleButton } from "@/components/auth/google-button";
import { AuthCard } from "@/components/layout/auth-card";
import { Link } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { pageMetadata } from "@/lib/seo";
import { SignUpForm } from "./sign-up-form";

export async function generateMetadata({ params }: PageProps<"/[locale]/sign-up">): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata({ locale: toLocale(locale), path: "/sign-up", page: "signUp", noIndex: true });
}

export default async function SignUpPage({ params }: PageProps<"/[locale]/sign-up">) {
  const { locale } = await params;
  setRequestLocale(toLocale(locale));
  const t = await getTranslations("Auth.signUp");

  return (
    <AuthCard title={t("title")} subtitle={t("subtitle")}>
      <GoogleButton />
      <AuthDivider />
      <SignUpForm />
      <p className="mt-6 border-t pt-4 text-sm text-muted-foreground">
        {t("haveAccount")}{" "}
        <Link href="/sign-in" className="font-medium text-link hover:underline">
          {t("signIn")}
        </Link>
      </p>
    </AuthCard>
  );
}
