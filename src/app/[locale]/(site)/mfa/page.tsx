import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { signOutAction } from "@/actions/auth";
import { FormAlert } from "@/components/forms/form-alert";
import { AuthCard } from "@/components/layout/auth-card";
import { toLocale } from "@/i18n/routing";
import { homePathFor, requireSession } from "@/lib/auth/session";
import { pageMetadata } from "@/lib/seo";
import { MfaFlow } from "./mfa-forms";

export async function generateMetadata({ params }: PageProps<"/[locale]/mfa">): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata({ locale: toLocale(locale), path: "/mfa", page: "mfa", noIndex: true });
}

export default async function MfaPage({ params }: PageProps<"/[locale]/mfa">) {
  const { locale } = await params;
  setRequestLocale(toLocale(locale));
  const session = await requireSession();
  const t = await getTranslations("Auth.mfa");

  // "done": already verified in this session. MfaFlow navigates home, unless it
  // still has to show the recovery codes of a just-completed enrollment.
  const mode = !session.hasVerifiedMfa ? "enroll" : session.aal === "aal2" ? "done" : "verify";
  const enrollingCopy = mode !== "verify";

  return (
    <AuthCard title={enrollingCopy ? t("enrollTitle") : t("verifyTitle")} subtitle={enrollingCopy ? t("enrollBody") : t("verifyBody")}>
      {mode === "enroll" && session.role === "admin" ? (
        <FormAlert variant="info" className="mb-5">
          {t("requiredForAdmins")}
        </FormAlert>
      ) : null}
      <MfaFlow mode={mode} home={homePathFor(session.role)} />
      <form action={signOutAction} className="mt-6 border-t pt-4">
        <button type="submit" className="text-sm text-link hover:underline">
          {t("useAnotherAccount")}
        </button>
      </form>
    </AuthCard>
  );
}
