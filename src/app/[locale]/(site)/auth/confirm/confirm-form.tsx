"use client";

import { useTranslations } from "next-intl";
import { confirmLinkAction } from "@/actions/auth";
import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { useProtectedAction } from "@/hooks/use-protected-action";
import { Link } from "@/i18n/navigation";

export function ConfirmForm({ tokenHash, type }: { tokenHash: string; type: string }) {
  const t = useTranslations("Auth");
  const te = useTranslations("Errors");
  const { state, onSubmit, pending } = useProtectedAction(confirmLinkAction);

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {state.error ? (
        <FormAlert variant="error">{state.error === "linkInvalid" ? t("confirm.invalid") : te(state.error)}</FormAlert>
      ) : null}
      <input type="hidden" name="token_hash" value={tokenHash} />
      <input type="hidden" name="type" value={type} />
      {state.error === "linkInvalid" ? (
        <Link href="/reset-password" className="text-sm text-link hover:underline">
          {t("reset.title")}
        </Link>
      ) : (
        <SubmitButton pending={pending} label={t("confirm.submit")} pendingLabel={t("confirm.submitting")} />
      )}
    </form>
  );
}
