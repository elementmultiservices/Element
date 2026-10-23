"use client";

import { useTranslations } from "next-intl";
import { markIntakeReviewedAction, reopenIntakeAction } from "@/actions/admin-intake";
import { ConfirmAction } from "@/components/admin/confirm-action";

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
