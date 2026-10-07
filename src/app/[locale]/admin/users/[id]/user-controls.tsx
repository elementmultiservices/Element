"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  activateUserAction,
  deactivateUserAction,
  forcePasswordResetAction,
  resendInvitationAction,
  updateQuotaAction,
  type QuotaField,
} from "@/actions/admin-users";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { FormAlert } from "@/components/forms/form-alert";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { useProtectedAction } from "@/hooks/use-protected-action";
import { useRouter } from "@/i18n/navigation";
import { MAX_QUOTA_MB } from "@/lib/validation/admin";

export function QuotaForm({ userId, quotaMb }: { userId: string; quotaMb: number }) {
  const t = useTranslations("Admin.users.detail");
  const tv = useTranslations("Validation");
  const te = useTranslations("Errors");
  const router = useRouter();
  const { state, onSubmit, pending } = useProtectedAction<QuotaField>(updateQuotaAction, {
    onSuccess: () => {
      toast.success(t("quotaSaved"));
      router.refresh();
    },
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {state.status === "error" && state.error ? <FormAlert variant="error">{te(state.error)}</FormAlert> : null}
      <input type="hidden" name="userId" value={userId} />
      <FormField
        name="quotaMb"
        type="number"
        label={t("quotaLabel")}
        hint={t("quotaHint")}
        min={0}
        max={MAX_QUOTA_MB}
        step={1}
        inputMode="numeric"
        defaultValue={String(quotaMb)}
        required
        className="max-w-xs"
        error={state.fieldErrors?.quotaMb ? tv(state.fieldErrors.quotaMb) : undefined}
      />
      <SubmitButton pending={pending} label={t("saveQuota")} pendingLabel={t("saveQuota")} className="w-auto" />
    </form>
  );
}

export function AccountActions({
  userId,
  isActive,
  invitationPending,
}: {
  userId: string;
  isActive: boolean;
  invitationPending: boolean;
}) {
  const t = useTranslations("Admin.users.actions");
  const tc = useTranslations("Admin.common");
  const fields = { id: userId };

  return (
    <div className="flex flex-wrap gap-2">
      {isActive ? (
        <ConfirmAction
          action={deactivateUserAction}
          fields={fields}
          destructive
          triggerLabel={t("deactivate")}
          title={t("deactivateTitle")}
          description={t("deactivateBody")}
          confirmLabel={t("deactivate")}
          successMessage={t("deactivated")}
        />
      ) : (
        <ConfirmAction
          action={activateUserAction}
          fields={fields}
          triggerLabel={t("activate")}
          title={t("activateTitle")}
          description={t("activateBody")}
          confirmLabel={t("activate")}
          successMessage={t("activated")}
        />
      )}
      {invitationPending && isActive ? (
        <ConfirmAction
          action={resendInvitationAction}
          fields={fields}
          triggerLabel={t("resend")}
          title={t("resendTitle")}
          description={t("resendBody")}
          confirmLabel={t("resend")}
          successMessage={t("resent")}
        />
      ) : null}
      {!invitationPending && isActive ? (
        <ConfirmAction
          action={forcePasswordResetAction}
          fields={fields}
          destructive
          triggerVariant="outline"
          triggerLabel={t("forceReset")}
          title={t("forceResetTitle")}
          description={t("forceResetBody")}
          confirmLabel={tc("confirm")}
          successMessage={t("forceResetDone")}
        />
      ) : null}
    </div>
  );
}
