"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  activateUserAction,
  changeRoleAction,
  deactivateUserAction,
  forcePasswordResetAction,
  grantUploadAction,
  resendInvitationAction,
  revokeUploadAction,
  updateQuotaAction,
  type QuotaField,
  type RoleField,
} from "@/actions/admin-users";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { FormAlert } from "@/components/forms/form-alert";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
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

/** Grants or revokes the permission to upload documents. */
export function UploadAccessControl({ userId, canUpload }: { userId: string; canUpload: boolean }) {
  const t = useTranslations("Admin.users.upload");
  const fields = { id: userId };
  return canUpload ? (
    <ConfirmAction
      action={revokeUploadAction}
      fields={fields}
      destructive
      triggerVariant="outline"
      triggerLabel={t("revoke")}
      title={t("revokeTitle")}
      description={t("revokeBody")}
      confirmLabel={t("revoke")}
      successMessage={t("revoked")}
    />
  ) : (
    <ConfirmAction
      action={grantUploadAction}
      fields={fields}
      triggerVariant="default"
      triggerLabel={t("grant")}
      title={t("grantTitle")}
      description={t("grantBody")}
      confirmLabel={t("grant")}
      successMessage={t("granted")}
    />
  );
}

export function AccountActions({
  userId,
  isActive,
  invitationPending,
  role,
}: {
  userId: string;
  isActive: boolean;
  invitationPending: boolean;
  role: "user" | "admin";
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
      {!invitationPending && isActive ? <RoleChangeButton userId={userId} currentRole={role} /> : null}
    </div>
  );
}

/** Role change with step-up verification (the acting admin enters a TOTP code). */
export function RoleChangeButton({ userId, currentRole }: { userId: string; currentRole: "user" | "admin" }) {
  const t = useTranslations("Admin.users.actions");
  const tc = useTranslations("Admin.common");
  const tv = useTranslations("Validation");
  const te = useTranslations("Errors");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const target = currentRole === "admin" ? "user" : "admin";
  const { state, onSubmit, pending } = useProtectedAction<RoleField>(changeRoleAction, {
    onSuccess: () => {
      setOpen(false);
      toast.success(t("roleChanged"));
      router.refresh();
    },
  });

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        setOpen(next);
        if (next) setFormKey((k) => k + 1);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          {target === "admin" ? t("makeAdmin") : t("makeUser")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <form key={formKey} onSubmit={onSubmit} noValidate className="space-y-4">
          <AlertDialogHeader>
            <AlertDialogTitle>{target === "admin" ? t("roleTitleAdmin") : t("roleTitleUser")}</AlertDialogTitle>
            <AlertDialogDescription>{target === "admin" ? t("roleBodyAdmin") : t("roleBodyUser")}</AlertDialogDescription>
          </AlertDialogHeader>
          {state.status === "error" && state.error && !state.fieldErrors?.code ? <FormAlert variant="error">{te(state.error)}</FormAlert> : null}
          <input type="hidden" name="id" value={userId} />
          <input type="hidden" name="role" value={target} />
          <p className="text-sm">{t("stepUp")}</p>
          <FormField
            name="code"
            id="field-stepup-code"
            label={t("stepUpCode")}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            className="max-w-48"
            error={state.fieldErrors?.code ? tv(state.fieldErrors.code) : undefined}
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>{tc("cancel")}</AlertDialogCancel>
            <SubmitButton pending={pending} label={tc("confirm")} pendingLabel={tc("working")} className="w-auto" />
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
