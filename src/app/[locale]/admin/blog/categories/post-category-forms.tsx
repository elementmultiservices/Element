"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { deletePostCategoryAction, savePostCategoryAction, type PostCategoryField } from "@/actions/admin-blog";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { FormAlert } from "@/components/forms/form-alert";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { useProtectedAction } from "@/hooks/use-protected-action";
import { useRouter } from "@/i18n/navigation";

type Category = { id: string; nameEn: string; nameEs: string; slugEn: string; slugEs: string };

export function PostCategoryForm({ category, onDone }: { category?: Category; onDone?: () => void }) {
  const t = useTranslations("Admin.postCategories");
  const tv = useTranslations("Validation");
  const te = useTranslations("Errors");
  const router = useRouter();
  const [formKey, setFormKey] = useState(0);
  const { state, onSubmit, pending } = useProtectedAction<PostCategoryField>(savePostCategoryAction, {
    onSuccess: () => {
      toast.success(category ? t("saved") : t("created"));
      if (!category) setFormKey((k) => k + 1);
      onDone?.();
      router.refresh();
    },
  });
  const fe = (f: PostCategoryField) => (state.fieldErrors?.[f] ? tv(state.fieldErrors[f]) : undefined);
  const idp = category ? `cat-${category.id}-` : "cat-new-";

  return (
    <form key={formKey} onSubmit={onSubmit} noValidate className="space-y-4">
      {state.status === "error" && state.error ? <FormAlert variant="error">{te(state.error)}</FormAlert> : null}
      {category ? <input type="hidden" name="id" value={category.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField name="nameEn" id={`${idp}nameEn`} label={t("nameEn")} lang="en" defaultValue={category?.nameEn} maxLength={80} required error={fe("nameEn")} />
        <FormField name="nameEs" id={`${idp}nameEs`} label={t("nameEs")} lang="es" defaultValue={category?.nameEs} maxLength={80} required error={fe("nameEs")} />
        <FormField name="slugEn" id={`${idp}slugEn`} label={t("slugEn")} hint={t("slugHint")} defaultValue={category?.slugEn} maxLength={100} className="font-mono" error={fe("slugEn")} />
        <FormField name="slugEs" id={`${idp}slugEs`} label={t("slugEs")} hint={t("slugHint")} defaultValue={category?.slugEs} maxLength={100} className="font-mono" error={fe("slugEs")} />
      </div>
      <div className="flex gap-2">
        <SubmitButton pending={pending} label={category ? t("save") : t("create")} pendingLabel={t("saving")} className="w-auto" />
        {onDone ? (
          <Button type="button" variant="outline" onClick={onDone} disabled={pending}>
            {t("cancel")}
          </Button>
        ) : null}
      </div>
    </form>
  );
}

export function PostCategoryRow({ category, displayName, postCount }: { category: Category; displayName: string; postCount: number }) {
  const t = useTranslations("Admin.postCategories");
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li className="bg-surface p-4">
        <PostCategoryForm category={category} onDone={() => setEditing(false)} />
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-medium">
          <span lang="en">{category.nameEn}</span> · <span lang="es">{category.nameEs}</span>
        </p>
        <p className="mt-0.5 font-mono text-xs text-muted-foreground">
          /en/blog?category={category.slugEn} · /es/blog?category={category.slugEs}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t("table.posts")}: {postCount}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
          {t("edit")}
        </Button>
        <ConfirmAction
          action={deletePostCategoryAction}
          fields={{ id: category.id }}
          destructive
          triggerVariant="outline"
          triggerLabel={t("delete")}
          title={t("deleteTitle")}
          description={t("deleteBody", { name: displayName })}
          confirmLabel={t("delete")}
          successMessage={t("deleted")}
        />
      </div>
    </li>
  );
}
