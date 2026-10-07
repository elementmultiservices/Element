"use client";

import { useTranslations } from "next-intl";
import { markMessageHandledAction, reopenMessageAction } from "@/actions/contact";
import { ConfirmAction } from "@/components/admin/confirm-action";

export function MessageStatusAction({ id, handled }: { id: string; handled: boolean }) {
  const t = useTranslations("Admin.messages");
  return handled ? (
    <ConfirmAction
      action={reopenMessageAction}
      fields={{ id }}
      triggerLabel={t("reopen")}
      title={t("reopenTitle")}
      description={t("reopenBody")}
      confirmLabel={t("reopen")}
      successMessage={t("reopened")}
    />
  ) : (
    <ConfirmAction
      action={markMessageHandledAction}
      fields={{ id }}
      triggerVariant="default"
      triggerLabel={t("markHandled")}
      title={t("markHandledTitle")}
      description={t("markHandledBody")}
      confirmLabel={t("markHandled")}
      successMessage={t("markedHandled")}
    />
  );
}
