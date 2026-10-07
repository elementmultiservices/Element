"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { inviteUserAction, type InviteField, type InviteState } from "@/actions/admin-users";
import { FormAlert } from "@/components/forms/form-alert";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { useProtectedAction } from "@/hooks/use-protected-action";
import { Link } from "@/i18n/navigation";
import { locales } from "@/i18n/routing";
import { DEFAULT_QUOTA_BYTES } from "@/lib/files/rules";
import { MAX_QUOTA_MB } from "@/lib/validation/admin";

export function InviteForm() {
  const t = useTranslations("Admin.users.invite");
  const tc = useTranslations("Common");
  const tv = useTranslations("Validation");
  const te = useTranslations("Errors");
  const locale = useLocale();
  const [formKey, setFormKey] = useState(0);
  const [dismissed, setDismissed] = useState<object | null>(null);
  const { state, onSubmit, pending } = useProtectedAction<InviteField>(inviteUserAction);
  const invite = state as InviteState;
  const fe = (f: InviteField) => (state.fieldErrors?.[f] ? tv(state.fieldErrors[f]) : undefined);

  if (state.status === "success" && invite.invitedId && state !== dismissed) {
    return (
      <div className="space-y-4 rounded-lg border bg-card p-6">
        <FormAlert variant="success">{t("success", { email: invite.invitedEmail ?? "" })}</FormAlert>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href={`/admin/users/${invite.invitedId}`}>{t("viewUser")}</Link>
          </Button>
          <Button type="button" variant="outline" onClick={() => {
              setDismissed(state);
              setFormKey((k) => k + 1);
            }}>
            {t("another")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form key={formKey} onSubmit={onSubmit} noValidate className="space-y-5 rounded-lg border bg-card p-6">
      {state.status === "error" && state.error ? <FormAlert variant="error">{te(state.error)}</FormAlert> : null}
      <FormAlert variant="info">{t("roleNote")}</FormAlert>
      <div className="grid gap-5 md:grid-cols-2">
        <FormField name="fullName" label={t("name")} autoComplete="off" maxLength={120} required error={fe("fullName")} />
        <FormField name="email" type="email" label={t("email")} autoComplete="off" maxLength={254} required error={fe("email")} />
        <div className="space-y-1.5">
          <Label htmlFor="invite-locale">{t("language")}</Label>
          <NativeSelect id="invite-locale" name="locale" defaultValue={locale}>
            {locales.map((l) => (
              <option key={l} value={l} lang={l}>
                {tc(`languages.${l}`)}
              </option>
            ))}
          </NativeSelect>
        </div>
        <FormField
          name="quotaMb"
          type="number"
          label={t("quota")}
          min={0}
          max={MAX_QUOTA_MB}
          step={1}
          inputMode="numeric"
          defaultValue={String(DEFAULT_QUOTA_BYTES / (1024 * 1024))}
          required
          error={fe("quotaMb")}
        />
      </div>
      <SubmitButton pending={pending} label={t("submit")} pendingLabel={t("submitting")} className="w-auto" />
    </form>
  );
}
