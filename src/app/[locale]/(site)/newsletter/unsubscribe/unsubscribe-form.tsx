"use client";

import { useTranslations } from "next-intl";
import { unsubscribeNewsletterAction } from "@/actions/newsletter";
import { FormAlert } from "@/components/forms/form-alert";
import { Button } from "@/components/ui/button";
import { useProtectedAction } from "@/hooks/use-protected-action";
import { Link } from "@/i18n/navigation";

export function UnsubscribeForm({ token }: { token: string }) {
  const t = useTranslations("Newsletter.unsubscribe");
  const te = useTranslations("Errors");
  const { state, onSubmit, pending } = useProtectedAction<never>(unsubscribeNewsletterAction);

  if (state.status === "success") {
    return (
      <div className="flex flex-col items-center gap-4">
        <FormAlert variant="success">{t("done")}</FormAlert>
        <Button asChild variant="outline-brand" size="pill-lg">
          <Link href="/">{t("home")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col items-center gap-4">
      {state.status === "error" && state.error ? <FormAlert variant="error">{te(state.error)}</FormAlert> : null}
      <input type="hidden" name="token" value={token} />
      <Button type="submit" variant="brand" size="pill-lg" disabled={pending || !token}>
        {pending ? t("working") : t("confirm")}
      </Button>
    </form>
  );
}
