"use client";

import { useTranslations } from "next-intl";
import { sendPostNewsletterAction } from "@/actions/newsletter";
import { ConfirmAction } from "@/components/admin/confirm-action";

export function SendNewsletterButton({ postId, count, again }: { postId: string; count: number; again: boolean }) {
  const t = useTranslations("Admin.blog.newsletter");
  return (
    <ConfirmAction
      action={sendPostNewsletterAction}
      fields={{ id: postId }}
      size="default"
      triggerVariant={again ? "outline" : "default"}
      triggerLabel={again ? t("sendAgain") : t("send")}
      title={again ? t("confirmAgainTitle") : t("confirmTitle")}
      description={t("confirmBody", { count })}
      confirmLabel={t("confirm", { count })}
      successMessage={t("sent")}
      className="shrink-0"
    />
  );
}
