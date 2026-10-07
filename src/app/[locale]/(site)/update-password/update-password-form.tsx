"use client";

import { useTranslations } from "next-intl";
import { updatePasswordAction, type UpdatePasswordField } from "@/actions/auth";
import { FormAlert } from "@/components/forms/form-alert";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { useProtectedAction } from "@/hooks/use-protected-action";

export function UpdatePasswordForm() {
  const t = useTranslations("Auth.update");
  const tv = useTranslations("Validation");
  const te = useTranslations("Errors");
  const { state, onSubmit, pending } = useProtectedAction<UpdatePasswordField>(updatePasswordAction);
  const fe = state.fieldErrors ?? {};

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {state.error ? <FormAlert variant="error">{te(state.error)}</FormAlert> : null}
      <FormField
        name="password"
        type="password"
        label={t("password")}
        hint={t("requirements")}
        autoComplete="new-password"
        required
        minLength={12}
        maxLength={128}
        error={fe.password ? tv(fe.password) : undefined}
      />
      <FormField
        name="confirmPassword"
        type="password"
        label={t("confirmPassword")}
        autoComplete="new-password"
        required
        maxLength={128}
        error={fe.confirmPassword ? tv(fe.confirmPassword) : undefined}
      />
      <SubmitButton pending={pending} label={t("submit")} pendingLabel={t("submitting")} />
    </form>
  );
}
