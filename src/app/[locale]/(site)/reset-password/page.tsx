import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthCard } from "@/components/layout/auth-card";
import { toLocale } from "@/i18n/routing";
import { pageMetadata } from "@/lib/seo";
import { ResetForm } from "./reset-form";

export async function generateMetadata({ params }: PageProps<"/[locale]/reset-password">): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata({ locale: toLocale(locale), path: "/reset-password", page: "resetPassword", noIndex: true });
}

export default async function ResetPasswordPage({ params }: PageProps<"/[locale]/reset-password">) {
  const { locale } = await params;
  setRequestLocale(toLocale(locale));
  const t = await getTranslations("Auth.reset");

  return (
    <AuthCard title={t("title")} subtitle={t("subtitle")}>
      <ResetForm />
    </AuthCard>
  );
}
