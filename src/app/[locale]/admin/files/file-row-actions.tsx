"use client";

import { useTranslations } from "next-intl";
import { deleteFilePermanentlyAction, restoreFileAction, trashFileAction } from "@/actions/admin-files";
import { ConfirmAction } from "@/components/admin/confirm-action";

export function TrashFileButton({ id, name }: { id: string; name: string }) {
  const t = useTranslations("Admin.files");
  return (
    <ConfirmAction
      action={trashFileAction}
      fields={{ id }}
      destructive
      triggerVariant="ghost"
      className="text-destructive hover:bg-error-bg hover:text-destructive"
      triggerLabel={t("trash")}
      title={t("trashTitle")}
      description={t("trashBody", { name })}
      confirmLabel={t("trash")}
      successMessage={t("trashed")}
    />
  );
}

export function TrashRowActions({ id, name }: { id: string; name: string }) {
  const t = useTranslations("Admin.trash");
  return (
    <div className="flex justify-end gap-2">
      <ConfirmAction
        action={restoreFileAction}
        fields={{ id }}
        triggerLabel={t("restore")}
        title={t("restoreTitle")}
        description={t("restoreBody", { name })}
        confirmLabel={t("restore")}
        successMessage={t("restored")}
      />
      <ConfirmAction
        action={deleteFilePermanentlyAction}
        fields={{ id }}
        destructive
        triggerLabel={t("delete")}
        title={t("deleteTitle")}
        description={t("deleteBody", { name })}
        confirmLabel={t("delete")}
        successMessage={t("deleted")}
      />
    </div>
  );
}
