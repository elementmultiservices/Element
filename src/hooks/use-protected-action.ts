"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import type { FormState } from "@/lib/forms";
import { useRecaptcha } from "./use-recaptcha";

/**
 * Wraps a server action with useActionState and, optionally, attaches a fresh
 * reCAPTCHA v3 token to the submitted FormData.
 */
export function useProtectedAction<Field extends string>(
  action: (prev: FormState<Field>, formData: FormData) => Promise<FormState<Field>>,
  options: { recaptchaAction?: string } = {},
) {
  const [state, formAction, isPending] = useActionState(action, { status: "idle" } as FormState<Field>);
  const [preparing, setPreparing] = useState(false);
  const getToken = useRecaptcha();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    if (options.recaptchaAction) {
      setPreparing(true);
      formData.set("recaptchaToken", await getToken(options.recaptchaAction));
      setPreparing(false);
    }
    startTransition(() => formAction(formData));
  }

  return { state, onSubmit, pending: isPending || preparing };
}
