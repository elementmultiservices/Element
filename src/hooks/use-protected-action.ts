"use client";

import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import type { FormState } from "@/lib/forms";
import { useRecaptcha } from "./use-recaptcha";

/**
 * Wraps a server action with useActionState and, optionally, attaches a fresh
 * reCAPTCHA v3 token to the submitted FormData. `onSuccess` runs once, right
 * after an action resolves successfully (no effects involved).
 */
export function useProtectedAction<Field extends string>(
  action: (prev: FormState<Field>, formData: FormData) => Promise<FormState<Field>>,
  options: { recaptchaAction?: string; lazyRecaptcha?: boolean; onSuccess?: (state: FormState<Field>) => void } = {},
) {
  const onSuccessRef = useRef(options.onSuccess);
  useEffect(() => {
    onSuccessRef.current = options.onSuccess;
  });

  // Actions that end in a redirect (sign-in, etc.) are passed through untouched;
  // the wrapper is only used when a success callback is requested.
  const withCallback = options.onSuccess !== undefined;
  const [state, formAction, isPending] = useActionState(
    withCallback
      ? async (prev: FormState<Field>, formData: FormData) => {
          const result = await action(prev, formData);
          if (result?.status === "success") onSuccessRef.current?.(result);
          return result;
        }
      : action,
    { status: "idle" } as FormState<Field>,
  );
  const [preparing, setPreparing] = useState(false);
  const getToken = useRecaptcha({ lazy: options.lazyRecaptcha });

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
