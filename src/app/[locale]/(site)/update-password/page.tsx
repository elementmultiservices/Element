import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthCard } from "@/components/layout/auth-card";
import { toLocale } from "@/i18n/routing";
import { requireSession } from "@/lib/auth/session";
import { pageMetadata } from "@/lib/seo";
import { UpdatePasswordForm } from "./update-password-form";

export async function generateMetadata({ params }: PageProps<"/[locale]/update-password">): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata({ locale: toLocale(locale), path: "/update-password", page: "updatePassword", noIndex: true });
}

export default async function UpdatePasswordPage({ params }: PageProps<"/[locale]/update-password">) {
  const { locale } = await params;
  setRequestLocale(toLocale(locale));
  await requireSession();
  const t = await getTranslations("Auth.update");

  return (
    <AuthCard title={t("title")} subtitle={t("subtitle")}>
      <UpdatePasswordForm />
    </AuthCard>
  );
}
