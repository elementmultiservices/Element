"use client";

import { useTranslations } from "next-intl";
import { deletePostAction } from "@/actions/admin-blog";
import { ConfirmAction } from "@/components/admin/confirm-action";

export function DeletePostButton({ id, onDeletedHref }: { id: string; onDeletedHref?: string }) {
  const t = useTranslations("Admin.blog");
  return (
    <ConfirmAction
      action={deletePostAction}
      fields={{ id }}
      destructive
      triggerVariant="ghost"
      className="text-destructive hover:bg-error-bg hover:text-destructive"
      triggerLabel={t("delete")}
      title={t("deleteTitle")}
      description={t("deleteBody")}
      confirmLabel={t("delete")}
      successMessage={t("deleted")}
      redirectTo={onDeletedHref}
    />
  );
}
