"use client";

import { useTranslations } from "next-intl";
import { signInAction, type SignInField } from "@/actions/auth";
import { FormAlert } from "@/components/forms/form-alert";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { useProtectedAction } from "@/hooks/use-protected-action";
import { Link } from "@/i18n/navigation";

export function SignInForm({ notice }: { notice?: "sessionEnded" | "passwordUpdated" | "mfaReset" | "oauthFailed" }) {
  const t = useTranslations("Auth");
  const tv = useTranslations("Validation");
  const te = useTranslations("Errors");
  const { state, onSubmit, pending } = useProtectedAction<SignInField>(signInAction, { recaptchaAction: "sign_in" });
  const fe = state.fieldErrors ?? {};

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {notice && state.status === "idle" ? <FormAlert variant={notice === "oauthFailed" ? "error" : "info"}>{t(`signIn.${notice}`)}</FormAlert> : null}
      {state.error ? <FormAlert variant="error">{te(state.error)}</FormAlert> : null}
      <FormField
        name="email"
        type="email"
        label={t("signIn.email")}
        autoComplete="username"
        inputMode="email"
        required
        maxLength={254}
        error={fe.email ? tv(fe.email) : undefined}
      />
      <FormField
        name="password"
        type="password"
        label={t("signIn.password")}
        autoComplete="current-password"
        required
        maxLength={128}
        error={fe.password ? tv(fe.password) : undefined}
      />
      <div className="flex justify-end">
        <Link href="/reset-password" className="text-sm text-link hover:underline">
          {t("signIn.forgot")}
        </Link>
      </div>
      <SubmitButton pending={pending} label={t("signIn.submit")} pendingLabel={t("signIn.submitting")} />
      <p className="text-xs text-muted-foreground">{t("recaptchaNotice")}</p>
    </form>
  );
}
