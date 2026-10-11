"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  preauthorizeUploadAction,
  removePreauthorizationAction,
  type UploadGrantField,
  type UploadGrantState,
} from "@/actions/admin-users";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { FormAlert } from "@/components/forms/form-alert";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { useProtectedAction } from "@/hooks/use-protected-action";
import { useRouter } from "@/i18n/navigation";

/** Authorizes an address: applied now if it has an account, otherwise when it signs up. */
export function PreauthorizeForm() {
  const t = useTranslations("Admin.users.upload");
  const tv = useTranslations("Validation");
  const te = useTranslations("Errors");
  const router = useRouter();
  const [formKey, setFormKey] = useState(0);
  const { state, onSubmit, pending } = useProtectedAction<UploadGrantField>(preauthorizeUploadAction, {
    onSuccess: () => {
      setFormKey((k) => k + 1);
      router.refresh();
    },
  });
  const result = state as UploadGrantState;

  return (
    <form key={formKey} onSubmit={onSubmit} noValidate className="space-y-4 rounded-lg border bg-card p-6">
      {state.status === "error" && state.error ? <FormAlert variant="error">{te(state.error)}</FormAlert> : null}
      {state.status === "success" && result.outcome ? (
        <FormAlert variant="success">
          {t(result.outcome === "granted" ? "grantedExisting" : "grantedPending", { email: result.email ?? "" })}
        </FormAlert>
      ) : null}
      <FormField
        name="email"
        type="email"
        label={t("emailLabel")}
        hint={t("emailHint")}
        autoComplete="off"
        inputMode="email"
        maxLength={254}
        required
        className="max-w-md"
        error={state.fieldErrors?.email ? tv(state.fieldErrors.email) : undefined}
      />
      <SubmitButton pending={pending} label={t("authorize")} pendingLabel={t("authorizing")} className="w-auto" />
    </form>
  );
}

export function RemoveGrantButton({ email }: { email: string }) {
  const t = useTranslations("Admin.users.upload");
  return (
    <ConfirmAction
      action={removePreauthorizationAction}
      fields={{ email }}
      destructive
      triggerVariant="ghost"
      triggerLabel={t("remove")}
      title={t("removeTitle")}
      description={t("removeBody", { email })}
      confirmLabel={t("remove")}
      successMessage={t("removed")}
    />
  );
}
