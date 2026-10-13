"use client";

import { useTranslations } from "next-intl";
import { removeSubscriberAction } from "@/actions/newsletter";
import { ConfirmAction } from "@/components/admin/confirm-action";

export function RemoveSubscriber({ id, email }: { id: string; email: string }) {
  const t = useTranslations("Admin.subscribers");
  return (
    <ConfirmAction
      action={removeSubscriberAction}
      fields={{ id }}
      triggerVariant="ghost"
      triggerLabel={t("remove")}
      title={t("removeTitle")}
      description={t("removeBody", { email })}
      confirmLabel={t("remove")}
      successMessage={t("removed")}
      destructive
    />
  );
}
