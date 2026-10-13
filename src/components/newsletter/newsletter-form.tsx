"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, Loader2 } from "lucide-react";
import { subscribeNewsletterAction, type NewsletterField } from "@/actions/newsletter";
import { useProtectedAction } from "@/hooks/use-protected-action";
import { loadRecaptcha } from "@/hooks/use-recaptcha";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * Email sign-up for the newsletter. `tone` adapts it to dark (footer, navy
 * cards) or light surfaces. reCAPTCHA loads only when the visitor starts typing.
 */
export function NewsletterForm({
  formToken,
  source,
  tone = "dark",
  className,
}: {
  formToken: string;
  source: "footer" | "home" | "blog";
  tone?: "dark" | "light";
  className?: string;
}) {
  const t = useTranslations("Newsletter.form");
  const tv = useTranslations("Validation");
  const te = useTranslations("Errors");
  const id = useId();
  const { state, onSubmit, pending } = useProtectedAction<NewsletterField>(subscribeNewsletterAction, {
    recaptchaAction: "newsletter",
    lazyRecaptcha: true,
  });
  const dark = tone === "dark";
  const fieldError = state.fieldErrors?.email ? tv(state.fieldErrors.email) : undefined;
  const error = fieldError ?? (state.status === "error" && state.error ? te(state.error) : undefined);

  if (state.status === "success") {
    return (
      <p
        role="status"
        className={cn(
          "motion-enter flex items-start gap-2.5 rounded-2xl px-4 py-3 text-sm",
          dark ? "bg-white/10 text-white" : "bg-success-bg text-success",
          className,
        )}
      >
        <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        {t("success")}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={`${id}-email`} className="sr-only">
        {t("label")}
      </label>
      <div
        className={cn(
          "flex items-center gap-1.5 rounded-full p-1.5 pl-5 ring-1 transition-shadow focus-within:ring-2",
          dark ? "bg-white ring-white/20 focus-within:ring-azure-300" : "bg-white ring-azure-100 focus-within:ring-electric",
        )}
      >
        <input
          id={`${id}-email`}
          name="email"
          type="email"
          required
          maxLength={254}
          autoComplete="email"
          placeholder={t("placeholder")}
          onFocus={loadRecaptcha}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : `${id}-note`}
          className="min-w-0 flex-1 bg-transparent py-2 text-[15px] text-ink outline-none placeholder:text-graphite/70"
        />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full bg-electric px-5 text-sm font-semibold text-white transition-colors hover:bg-electric-hover disabled:opacity-70"
        >
          {pending ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
          {t("submit")}
        </button>
      </div>
      <input type="hidden" name="formToken" value={formToken} />
      <input type="hidden" name="source" value={source} />
      <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
        <label htmlFor={`${id}-website`}>{t("honeypot")}</label>
        <input id={`${id}-website`} name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className={cn("px-2 text-sm", dark ? "text-red-300" : "text-destructive")}>
          {error}
        </p>
      ) : (
        <p id={`${id}-note`} className={cn("px-2 text-xs", dark ? "text-azure-100/80" : "text-graphite")}>
          {t("note")}{" "}
          <Link href="/legal/privacy" className="underline underline-offset-2">
            {t("privacy")}
          </Link>
        </p>
      )}
    </form>
  );
}
