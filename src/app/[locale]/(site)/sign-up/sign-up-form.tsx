"use client";

import { useTranslations } from "next-intl";
import { signUpAction, type SignUpField } from "@/actions/auth";
import { FormAlert } from "@/components/forms/form-alert";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { useProtectedAction } from "@/hooks/use-protected-action";
import { Link } from "@/i18n/navigation";

export function SignUpForm() {
  const t = useTranslations("Auth");
  const tv = useTranslations("Validation");
  const te = useTranslations("Errors");
  const { state, onSubmit, pending } = useProtectedAction<SignUpField>(signUpAction, { recaptchaAction: "sign_up" });
  const fe = state.fieldErrors ?? {};

  if (state.status === "success") {
    return <FormAlert variant="success">{t("signUp.success")}</FormAlert>;
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {state.error ? <FormAlert variant="error">{te(state.error)}</FormAlert> : null}
      <FormField
        name="fullName"
        label={t("signUp.fullName")}
        autoComplete="name"
        required
        maxLength={120}
        error={fe.fullName ? tv(fe.fullName) : undefined}
      />
      <FormField
        name="email"
        type="email"
        label={t("signUp.email")}
        autoComplete="email"
        inputMode="email"
        required
        maxLength={254}
        error={fe.email ? tv(fe.email) : undefined}
      />
      <div className="space-y-1.5">
        <div className="flex items-start gap-3">
          <input
            id="field-consent"
            name="consent"
            type="checkbox"
            required
            aria-invalid={fe.consent ? true : undefined}
            aria-describedby={fe.consent ? "field-consent-error" : undefined}
            className="mt-1 size-4 shrink-0 accent-[var(--primary)]"
          />
          <label htmlFor="field-consent" className="text-sm">
            {t("signUp.consent")}{" "}
            <Link href="/legal/terms" className="text-link underline" target="_blank">
              {t("signUp.terms")}
            </Link>{" "}
            {t("signUp.and")}{" "}
            <Link href="/legal/data-policy" className="text-link underline" target="_blank">
              {t("signUp.dataPolicy")}
            </Link>
            .<span aria-hidden="true" className="text-destructive"> *</span>
          </label>
        </div>
        {fe.consent ? (
          <p id="field-consent-error" role="alert" className="text-sm text-destructive">
            {tv(fe.consent)}
          </p>
        ) : null}
      </div>
      <p className="text-sm text-muted-foreground">{t("signUp.passwordNote")}</p>
      <SubmitButton pending={pending} label={t("signUp.submit")} pendingLabel={t("signUp.submitting")} />
      <p className="text-xs text-muted-foreground">{t("recaptchaNotice")}</p>
    </form>
  );
}
