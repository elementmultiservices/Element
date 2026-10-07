"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  changePasswordAction,
  disableMfaAction,
  regenerateRecoveryCodesAction,
  updateLocaleAction,
  updateNameAction,
  type ChangePasswordField,
  type DisableMfaField,
  type NameField,
  type RegenerateField,
  type RegenerateState,
} from "@/actions/profile";
import { RecoveryCodesPanel } from "@/components/auth/recovery-codes-panel";
import { FormAlert } from "@/components/forms/form-alert";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { useProtectedAction } from "@/hooks/use-protected-action";
import { Link, useRouter } from "@/i18n/navigation";
import { locales, type AppLocale } from "@/i18n/routing";

export function NameForm({ fullName }: { fullName: string }) {
  const t = useTranslations("Profile.details");
  const tv = useTranslations("Validation");
  const te = useTranslations("Errors");
  const { state, onSubmit, pending } = useProtectedAction<NameField>(updateNameAction);

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {state.status === "success" ? <FormAlert variant="success">{t("saved")}</FormAlert> : null}
      {state.error ? <FormAlert variant="error">{te(state.error)}</FormAlert> : null}
      <FormField
        name="fullName"
        label={t("name")}
        defaultValue={fullName}
        autoComplete="name"
        required
        maxLength={120}
        error={state.fieldErrors?.fullName ? tv(state.fieldErrors.fullName) : undefined}
      />
      <SubmitButton pending={pending} label={t("save")} pendingLabel={t("saving")} className="w-auto" />
    </form>
  );
}

export function LocaleForm({ current }: { current: AppLocale }) {
  const t = useTranslations("Profile.language");
  const tc = useTranslations("Common.languages");
  const te = useTranslations("Errors");
  const { state, onSubmit, pending } = useProtectedAction(updateLocaleAction);

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {state.error ? <FormAlert variant="error">{te(state.error)}</FormAlert> : null}
      <div className="max-w-xs space-y-1.5">
        <Label htmlFor="profile-locale">{t("label")}</Label>
        <NativeSelect id="profile-locale" name="locale" defaultValue={current}>
          {locales.map((l) => (
            <option key={l} value={l} lang={l}>
              {tc(l)}
            </option>
          ))}
        </NativeSelect>
      </div>
      <SubmitButton pending={pending} label={t("save")} pendingLabel={t("saving")} className="w-auto" />
    </form>
  );
}

export function PasswordForm() {
  const t = useTranslations("Profile.password");
  const tu = useTranslations("Auth.update");
  const tv = useTranslations("Validation");
  const te = useTranslations("Errors");
  const formRef = useRef<HTMLFormElement>(null);
  const { state, onSubmit, pending } = useProtectedAction<ChangePasswordField>(changePasswordAction);
  const fe = state.fieldErrors ?? {};

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="max-w-md space-y-4">
      {state.status === "success" ? <FormAlert variant="success">{t("success")}</FormAlert> : null}
      {state.error ? <FormAlert variant="error">{te(state.error)}</FormAlert> : null}
      <FormField
        name="currentPassword"
        type="password"
        label={t("current")}
        autoComplete="current-password"
        required
        maxLength={128}
        error={fe.currentPassword ? tv(fe.currentPassword) : undefined}
      />
      <FormField
        name="password"
        type="password"
        label={t("new")}
        hint={tu("requirements")}
        autoComplete="new-password"
        required
        maxLength={128}
        error={fe.password ? tv(fe.password) : undefined}
      />
      <FormField
        name="confirmPassword"
        type="password"
        label={t("confirm")}
        autoComplete="new-password"
        required
        maxLength={128}
        error={fe.confirmPassword ? tv(fe.confirmPassword) : undefined}
      />
      <SubmitButton pending={pending} label={t("submit")} pendingLabel={t("submitting")} className="w-auto" />
    </form>
  );
}

/**
 * MFA controls. The action state lives here (not in the disable form) so the
 * confirmation survives the server refresh that removes the disable form.
 */
export function MfaControls({ enabled, isAdmin }: { enabled: boolean; isAdmin: boolean }) {
  const t = useTranslations("Profile.mfa");
  const tv = useTranslations("Validation");
  const te = useTranslations("Errors");
  const { state, onSubmit, pending } = useProtectedAction<DisableMfaField>(disableMfaAction);

  return (
    <div className="space-y-4">
      {state.status === "success" ? <FormAlert variant="success">{t("disabledSuccess")}</FormAlert> : null}
      {isAdmin ? (
        <p className="text-sm text-muted-foreground">{t("requiredForAdmins")}</p>
      ) : enabled ? (
        <form onSubmit={onSubmit} noValidate className="space-y-4 rounded-md border bg-surface p-4">
          <div>
            <h3 className="text-sm font-semibold">{t("disableHeading")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t("disableHint")}</p>
          </div>
          {state.error ? <FormAlert variant="error">{te(state.error)}</FormAlert> : null}
          <FormField
            name="code"
            label={t("code")}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            className="max-w-48"
            error={state.fieldErrors?.code ? tv(state.fieldErrors.code) : undefined}
          />
          <SubmitButton pending={pending} label={t("disable")} pendingLabel={t("disabling")} className="w-auto" />
        </form>
      ) : (
        <Button asChild>
          <Link href="/mfa">{t("enable")}</Link>
        </Button>
      )}
    </div>
  );
}

/** Remaining recovery codes and regeneration (requires a current TOTP code). */
export function RecoveryCodesSection({ remaining }: { remaining: number }) {
  const t = useTranslations("Profile.recovery");
  const tv = useTranslations("Validation");
  const te = useTranslations("Errors");
  const router = useRouter();
  const [codes, setCodes] = useState<string[] | null>(null);
  const [formKey, setFormKey] = useState(0);
  const { state, onSubmit, pending } = useProtectedAction<RegenerateField>(regenerateRecoveryCodesAction, {
    onSuccess: (result) => {
      const issued = (result as RegenerateState).recoveryCodes;
      if (issued) setCodes(issued);
    },
  });

  if (codes) {
    return (
      <div className="space-y-4">
        <FormAlert variant="success">{t("regenerated")}</FormAlert>
        <RecoveryCodesPanel
          codes={codes}
          continueLabel={t("done")}
          onContinue={() => {
            setCodes(null);
            setFormKey((k) => k + 1);
            router.refresh();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-md border bg-surface p-4">
      <div>
        <h3 className="text-sm font-semibold">{t("heading")}</h3>
        <p className={remaining > 0 ? "mt-1 text-sm text-muted-foreground" : "mt-1 text-sm text-warning"}>
          {remaining > 0 ? t("remaining", { count: remaining }) : t("none")}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{t("regenerateHint")}</p>
      </div>
      <form key={formKey} onSubmit={onSubmit} noValidate className="space-y-3">
        {state.status === "error" && state.error ? <FormAlert variant="error">{te(state.error)}</FormAlert> : null}
        <FormField
          name="code"
          id="field-regenerate-code"
          label={t("code")}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
          className="max-w-48"
          error={state.fieldErrors?.code ? tv(state.fieldErrors.code) : undefined}
        />
        <SubmitButton pending={pending} label={t("regenerate")} pendingLabel={t("regenerating")} className="w-auto" />
      </form>
    </div>
  );
}
