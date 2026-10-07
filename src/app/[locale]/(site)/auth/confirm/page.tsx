import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { FormAlert } from "@/components/forms/form-alert";
import { AuthCard } from "@/components/layout/auth-card";
import { toLocale } from "@/i18n/routing";
import { pageMetadata } from "@/lib/seo";
import { confirmLinkSchema } from "@/lib/validation/auth";
import { ConfirmForm } from "./confirm-form";

export async function generateMetadata({ params }: PageProps<"/[locale]/auth/confirm">): Promise<Metadata> {
  const { locale } = await params;
  const base = await pageMetadata({ locale: toLocale(locale), path: "/auth/confirm", page: "confirm", noIndex: true });
  // The URL carries a one-time token: never leak it through the Referer header.
  return { ...base, referrer: "no-referrer" };
}

/**
 * Landing page for invitation and recovery links. Nothing is verified on GET:
 * the user must press "Continue", so link scanners cannot consume the token.
 */
export default async function ConfirmPage({ params, searchParams }: PageProps<"/[locale]/auth/confirm">) {
  const { locale } = await params;
  setRequestLocale(toLocale(locale));
  const t = await getTranslations("Auth.confirm");
  const { token_hash: tokenHash, type } = await searchParams;

  const parsed = confirmLinkSchema.safeParse({ tokenHash, type });

  return (
    <AuthCard title={t("title")} subtitle={parsed.success ? t("body") : undefined}>
      {parsed.success ? (
        <ConfirmForm tokenHash={parsed.data.tokenHash} type={parsed.data.type} />
      ) : (
        <FormAlert variant="error">{t("invalid")}</FormAlert>
      )}
    </AuthCard>
  );
}
