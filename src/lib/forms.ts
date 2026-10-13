import type { Messages } from "next-intl";
import type { z } from "zod";

export type ValidationKey = keyof Messages["Validation"];
export type ErrorKey = keyof Messages["Errors"];

export type FormState<Field extends string = string> = {
  status: "idle" | "error" | "success";
  error?: ErrorKey;
  fieldErrors?: Partial<Record<Field, ValidationKey>>;
};

export const idleState: FormState = { status: "idle" };

const validationKeys = new Set<string>([
  "required",
  "emailInvalid",
  "passwordMin",
  "passwordMax",
  "passwordComplexity",
  "passwordMismatch",
  "codeInvalid",
  "tooLong",
  "invalid",
  "consentRequired",
  "messageMin",
  "slugInvalid",
  "slugTaken",
  "titleRequired",
  "contentRequired",
  "translationRequired",
  "scheduleFuture",
  "dateRequired",
  "phoneInvalid",
  "urlInvalid",
] satisfies ValidationKey[]);

/** Maps Zod issues (whose messages are translation keys) to the first error per field. */
export function fieldErrorsFrom<Field extends string>(error: z.ZodError): Partial<Record<Field, ValidationKey>> {
  const out: Partial<Record<string, ValidationKey>> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "");
    if (!field || out[field]) continue;
    out[field] = validationKeys.has(issue.message) ? (issue.message as ValidationKey) : "invalid";
  }
  return out as Partial<Record<Field, ValidationKey>>;
}
