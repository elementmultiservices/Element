"use client";

import { useTranslations } from "next-intl";
import { requestPasswordResetAction, type ResetField } from "@/actions/auth";
import { FormAlert } from "@/components/forms/form-alert";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { useProtectedAction } from "@/hooks/use-protected-action";
import { Link } from "@/i18n/navigation";

export function ResetForm() {
  const t = useTranslations("Auth");
  const tv = useTranslations("Validation");
  const te = useTranslations("Errors");
  const { state, onSubmit, pending } = useProtectedAction<ResetField>(requestPasswordResetAction, {
    recaptchaAction: "password_reset",
  });

  if (state.status === "success") {
    return (
      <div className="space-y-5">
        <FormAlert variant="success">{t("reset.success")}</FormAlert>
        <Link href="/sign-in" className="text-sm text-link hover:underline">
          {t("reset.backToSignIn")}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {state.error ? <FormAlert variant="error">{te(state.error)}</FormAlert> : null}
      <FormField
        name="email"
        type="email"
        label={t("reset.email")}
        autoComplete="email"
        inputMode="email"
        required
        maxLength={254}
        error={state.fieldErrors?.email ? tv(state.fieldErrors.email) : undefined}
      />
      <SubmitButton pending={pending} label={t("reset.submit")} pendingLabel={t("reset.submitting")} />
      <div className="flex items-center justify-between gap-4">
        <Link href="/sign-in" className="text-sm text-link hover:underline">
          {t("reset.backToSignIn")}
        </Link>
      </div>
      <p className="text-xs text-muted-foreground">{t("recaptchaNotice")}</p>
    </form>
  );
}
