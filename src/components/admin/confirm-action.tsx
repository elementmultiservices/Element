"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { FormAlert } from "@/components/forms/form-alert";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import type { ErrorKey, FormState } from "@/lib/forms";

type Action = (prev: FormState<never>, formData: FormData) => Promise<FormState<never>>;

/**
 * Button + confirmation dialog for an administrative server action. The action
 * re-checks authorization on the server; this only prevents accidental clicks.
 */
export function ConfirmAction({
  action,
  fields,
  triggerLabel,
  title,
  description,
  confirmLabel,
  successMessage,
  destructive = false,
  size = "sm",
  triggerVariant,
  className,
}: {
  action: Action;
  fields: Record<string, string>;
  triggerLabel: string;
  title: string;
  description: string;
  confirmLabel: string;
  successMessage: string;
  destructive?: boolean;
  size?: "sm" | "default";
  triggerVariant?: "outline" | "ghost" | "destructive" | "default";
  className?: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<ErrorKey | null>(null);

  function submit() {
    const formData = new FormData();
    for (const [k, v] of Object.entries(fields)) formData.set(k, v);
    setError(null);
    startTransition(async () => {
      const result = await action({ status: "idle" }, formData);
      if (result.status === "success") {
        setOpen(false);
        toast.success(successMessage);
        router.refresh();
      } else {
        setError(result.error ?? "generic");
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={(next) => {
        if (pending) return;
        setError(null);
        setOpen(next);
      }}>
      <AlertDialogTrigger asChild>
        <Button type="button" size={size} variant={triggerVariant ?? (destructive ? "destructive" : "outline")} className={className}>
          {triggerLabel}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <FormAlert variant="error">{t(`Errors.${error}`)}</FormAlert> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{t("Admin.common.cancel")}</AlertDialogCancel>
          <Button type="button" variant={destructive ? "destructive" : "default"} onClick={submit} disabled={pending}>
            {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
            {pending ? t("Admin.common.working") : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
