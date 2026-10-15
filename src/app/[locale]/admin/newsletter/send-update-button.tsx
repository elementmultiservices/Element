"use client";

import { useTranslations } from "next-intl";
import { sendUpdateNewsletterAction } from "@/actions/newsletter";
import { ConfirmAction } from "@/components/admin/confirm-action";

export function SendUpdateButton({ slug, title, count, again }: { slug: string; title: string; count: number; again: boolean }) {
  const t = useTranslations("Admin.newsletter");
  return (
    <ConfirmAction
      action={sendUpdateNewsletterAction}
      fields={{ slug }}
      triggerVariant={again ? "outline" : "default"}
      triggerLabel={again ? t("sendAgain") : t("send")}
      title={again ? t("confirmAgainTitle") : t("confirmTitle")}
      description={t("confirmBody", { count, title })}
      confirmLabel={t("confirm", { count })}
      successMessage={t("sent")}
      className="shrink-0"
    />
  );
}
