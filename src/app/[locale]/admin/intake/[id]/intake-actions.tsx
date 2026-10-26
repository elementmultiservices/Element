"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Loader2, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { assignIntakeAction, inviteAndAssignIntakeAction, markIntakeReviewedAction, reopenIntakeAction, unassignIntakeAction } from "@/actions/admin-intake";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { OwnerPicker, type OwnerOption } from "@/components/files/owner-picker";
import { FormAlert } from "@/components/forms/form-alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useRouter } from "@/i18n/navigation";
import type { ErrorKey } from "@/lib/forms";

export function IntakeStatusAction({ id, reviewed }: { id: string; reviewed: boolean }) {
  const t = useTranslations("Admin.intake");
  return reviewed ? (
    <ConfirmAction
      action={reopenIntakeAction}
      fields={{ id }}
      triggerLabel={t("reopen")}
      title={t("reopenTitle")}
      description={t("reopenBody")}
      confirmLabel={t("reopen")}
      successMessage={t("reopened")}
    />
  ) : (
    <ConfirmAction
      action={markIntakeReviewedAction}
      fields={{ id }}
      triggerVariant="default"
      triggerLabel={t("markReviewed")}
      title={t("markReviewedTitle")}
      description={t("markReviewedBody")}
      confirmLabel={t("markReviewed")}
      successMessage={t("markedReviewed")}
    />
  );
}

/** Assigns the form to the account that uses the email typed in it. */
export function AssignToMatchAction({ id, userId, name }: { id: string; userId: string; name: string }) {
  const t = useTranslations("Admin.intake.assign");
  return (
    <ConfirmAction
      action={assignIntakeAction}
      fields={{ id, userId }}
      triggerVariant="default"
      triggerLabel={t("assignMatch")}
      title={t("assignTitle", { name })}
      description={t("assignBody")}
      confirmLabel={t("assignConfirm")}
      successMessage={t("assigned")}
    />
  );
}

/** Creates an account with the form's email (invitation sent) and assigns the form to it. */
export function InviteAndAssignAction({ id, email }: { id: string; email: string }) {
  const t = useTranslations("Admin.intake.assign");
  return (
    <ConfirmAction
      action={inviteAndAssignIntakeAction}
      fields={{ id }}
      triggerVariant="default"
      triggerLabel={t("invite")}
      title={t("inviteTitle", { email })}
      description={t("inviteBody")}
      confirmLabel={t("inviteConfirm")}
      successMessage={t("invited", { email })}
    />
  );
}

export function UnassignAction({ id }: { id: string }) {
  const t = useTranslations("Admin.intake.assign");
  return (
    <ConfirmAction
      action={unassignIntakeAction}
      fields={{ id }}
      destructive
      triggerVariant="outline"
      triggerLabel={t("unassign")}
      title={t("unassignTitle")}
      description={t("unassignBody")}
      confirmLabel={t("unassign")}
      successMessage={t("unassigned")}
    />
  );
}

/** Staff pick any client account for the form. */
export function AssignPicker({ id, owners, currentOwnerId }: { id: string; owners: OwnerOption[]; currentOwnerId: string | null }) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<ErrorKey | null>(null);
  const pickerId = `assign-${id}`;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set("id", id);
    const userId = formData.get("userId");
    if (typeof userId !== "string" || !userId) return setError("intakeAssignInvalid");
    if (userId === currentOwnerId) return;
    setError(null);
    startTransition(async () => {
      const result = await assignIntakeAction({ status: "idle" }, formData);
      if (result.status === "success") {
        toast.success(t("Admin.intake.assign.assigned"));
        router.refresh();
      } else {
        setError(result.error ?? "generic");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <Label htmlFor={pickerId}>{t(currentOwnerId ? "Admin.intake.assign.pickerChange" : "Admin.intake.assign.pickerLabel")}</Label>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <OwnerPicker id={pickerId} name="userId" owners={owners} disabled={pending} invalid={error === "intakeAssignInvalid"} />
        </div>
        <Button type="submit" variant="outline" disabled={pending} className="shrink-0">
          {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <UserCheck aria-hidden="true" />}
          {pending ? t("Admin.common.working") : t("Admin.intake.assign.pickerSubmit")}
        </Button>
      </div>
      {error ? <FormAlert variant="error">{t(`Errors.${error}`)}</FormAlert> : null}
    </form>
  );
}
