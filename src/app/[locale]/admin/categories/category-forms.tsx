"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  archiveCategoryAction,
  createCategoryAction,
  renameCategoryAction,
  unarchiveCategoryAction,
  type CategoryField,
} from "@/actions/admin-categories";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { FormAlert } from "@/components/forms/form-alert";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { useProtectedAction } from "@/hooks/use-protected-action";
import { useRouter } from "@/i18n/navigation";

export function CreateCategoryForm() {
  const t = useTranslations("Admin.categories");
  const tv = useTranslations("Validation");
  const te = useTranslations("Errors");
  const router = useRouter();
  const [formKey, setFormKey] = useState(0);
  const { state, onSubmit, pending } = useProtectedAction<CategoryField>(createCategoryAction, {
    onSuccess: () => {
      toast.success(t("created"));
      setFormKey((k) => k + 1);
      router.refresh();
    },
  });

  return (
    <form key={formKey} onSubmit={onSubmit} noValidate className="space-y-4">
      {state.status === "error" && state.error ? <FormAlert variant="error">{te(state.error)}</FormAlert> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField name="nameEn" label={t("nameEn")} lang="en" maxLength={80} required error={state.fieldErrors?.nameEn ? tv(state.fieldErrors.nameEn) : undefined} />
        <FormField name="nameEs" label={t("nameEs")} lang="es" maxLength={80} required error={state.fieldErrors?.nameEs ? tv(state.fieldErrors.nameEs) : undefined} />
      </div>
      <SubmitButton pending={pending} label={t("create")} pendingLabel={t("creating")} className="w-auto" />
    </form>
  );
}

export function CategoryRowActions({
  id,
  nameEn,
  nameEs,
  isArchived,
  displayName,
}: {
  id: string;
  nameEn: string;
  nameEs: string;
  isArchived: boolean;
  displayName: string;
}) {
  const t = useTranslations("Admin.categories");
  const tc = useTranslations("Admin.common");
  const tv = useTranslations("Validation");
  const te = useTranslations("Errors");
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const { state, onSubmit, pending } = useProtectedAction<CategoryField>(renameCategoryAction, {
    onSuccess: () => {
      toast.success(t("renamed"));
      setEditing(false);
      router.refresh();
    },
  });

  if (editing) {
    return (
      <form onSubmit={onSubmit} noValidate className="space-y-3 rounded-2xl border border-azure-50 bg-mist p-3 text-left" aria-label={t("renameTitle")}>
        {state.status === "error" && state.error ? <FormAlert variant="error">{te(state.error)}</FormAlert> : null}
        <input type="hidden" name="id" value={id} />
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField name="nameEn" label={t("nameEn")} lang="en" defaultValue={nameEn} maxLength={80} required error={state.fieldErrors?.nameEn ? tv(state.fieldErrors.nameEn) : undefined} />
          <FormField name="nameEs" label={t("nameEs")} lang="es" defaultValue={nameEs} maxLength={80} required error={state.fieldErrors?.nameEs ? tv(state.fieldErrors.nameEs) : undefined} />
        </div>
        <div className="flex gap-2">
          <SubmitButton pending={pending} label={t("save")} pendingLabel={t("save")} className="h-8 w-auto" />
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing(false)} disabled={pending}>
            {tc("cancel")}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
        {t("rename")}
      </Button>
      {isArchived ? (
        <ConfirmAction
          action={unarchiveCategoryAction}
          fields={{ id }}
          triggerLabel={t("unarchive")}
          title={t("unarchive")}
          description={displayName}
          confirmLabel={t("unarchive")}
          successMessage={t("unarchived")}
        />
      ) : (
        <ConfirmAction
          action={archiveCategoryAction}
          fields={{ id }}
          destructive
          triggerVariant="outline"
          triggerLabel={t("archive")}
          title={t("archiveTitle")}
          description={t("archiveBody", { name: displayName })}
          confirmLabel={t("archive")}
          successMessage={t("archived")}
        />
      )}
    </div>
  );
}
