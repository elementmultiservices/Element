"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { submitContactAction, type ContactField } from "@/actions/contact";
import { FormAlert } from "@/components/forms/form-alert";
import { Button } from "@/components/ui/button";
import { useProtectedAction } from "@/hooks/use-protected-action";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { CONTACT_NEEDS } from "@/lib/validation/blog";

const input =
  "w-full rounded-2xl border border-azure-100 bg-azure-25 px-4 text-[15px] text-ink outline-none transition-colors placeholder:text-graphite/60 focus:border-electric focus:bg-white aria-invalid:border-destructive";

/** Short "question before your visit" form. Uses the contact pipeline (spam checks, inbox, acknowledgement). */
export function VisitQuestionForm({ formToken }: { formToken: string }) {
  const t = useTranslations("Contact");
  const tv = useTranslations("Validation");
  const te = useTranslations("Errors");
  const ta = useTranslations("Auth");
  const tl = useTranslations("Common.languages");
  const locale = useLocale();
  const [formKey, setFormKey] = useState(0);
  const [dismissed, setDismissed] = useState<object | null>(null);
  const { state, onSubmit, pending } = useProtectedAction<ContactField>(submitContactAction, { recaptchaAction: "contact" });
  const fe = (f: ContactField) => (state.fieldErrors?.[f] ? tv(state.fieldErrors[f]) : undefined);

  if (state.status === "success" && state !== dismissed) {
    return (
      <div className="motion-enter flex flex-col items-start gap-4">
        <FormAlert variant="success">
          <p className="font-semibold">{t("successTitle")}</p>
          <p>{t("success")}</p>
        </FormAlert>
        <Button
          type="button"
          variant="outline-brand"
          size="pill"
          onClick={() => {
            setDismissed(state);
            setFormKey((k) => k + 1);
          }}
        >
          {t("sendAnother")}
        </Button>
      </div>
    );
  }

  const field = (name: ContactField, label: string, control: React.ReactNode, required = true) => (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`visit-${name}`} className="text-sm font-semibold text-ink">
        {label}
        {required ? <span aria-hidden="true" className="text-destructive"> *</span> : null}
      </label>
      {control}
      {fe(name) ? (
        <p id={`visit-${name}-error`} role="alert" className="text-sm text-destructive">
          {fe(name)}
        </p>
      ) : null}
    </div>
  );
  const aria = (name: ContactField) => ({
    id: `visit-${name}`,
    name,
    "aria-invalid": fe(name) ? true : undefined,
    "aria-describedby": fe(name) ? `visit-${name}-error` : undefined,
  });

  return (
    <form key={formKey} onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {state.status === "error" && state.error ? <FormAlert variant="error">{te(state.error)}</FormAlert> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        {field("name", t("name"), <input {...aria("name")} required maxLength={120} autoComplete="name" placeholder={t("namePlaceholder")} className={cn(input, "h-12")} />)}
        {field(
          "phone",
          t("phone"),
          <input {...aria("phone")} type="tel" maxLength={40} autoComplete="tel" placeholder={t("phonePlaceholder")} className={cn(input, "h-12")} />,
          false,
        )}
      </div>
      {field("email", t("email"), <input {...aria("email")} type="email" required maxLength={254} autoComplete="email" placeholder={t("emailPlaceholder")} className={cn(input, "h-12")} />)}
      {field(
        "need",
        t("need"),
        <div className="relative">
          <select {...aria("need")} defaultValue="personal" className={cn(input, "h-12 appearance-none pr-10")}>
            {CONTACT_NEEDS.map((need) => (
              <option key={need} value={need}>
                {t(`needs.${need}`)}
              </option>
            ))}
          </select>
          <ChevronDown aria-hidden="true" className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-graphite" />
        </div>,
      )}
      {field(
        "message",
        t("shortMessage"),
        <textarea {...aria("message")} required rows={4} maxLength={5000} placeholder={t("messagePlaceholder")} className={cn(input, "resize-y py-3")} />,
      )}

      <fieldset className="flex flex-wrap items-center gap-3">
        <legend className="float-left mr-1 text-sm font-semibold text-ink">{t("preferredLanguage")}</legend>
        {(["es", "en"] as const).map((l) => (
          <label
            key={l}
            className="flex cursor-pointer items-center gap-2 rounded-full bg-azure-25 px-4 py-2 text-sm text-ink has-checked:bg-azure-50 has-checked:ring-1 has-checked:ring-electric"
          >
            <input type="radio" name="preferredLanguage" value={l} defaultChecked={l === locale} className="size-4 accent-[var(--brand-electric)]" />
            <span lang={l}>{tl(l)}</span>
          </label>
        ))}
      </fieldset>

      <input type="hidden" name="formToken" value={formToken} />
      <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
        <label htmlFor="visit-website">{t("honeypot")}</label>
        <input id="visit-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-start gap-3">
          <input
            id="visit-consent"
            name="consent"
            type="checkbox"
            required
            aria-invalid={fe("consent") ? true : undefined}
            aria-describedby={fe("consent") ? "visit-consent-error" : undefined}
            className="mt-1 size-4 shrink-0 accent-[var(--brand-electric)]"
          />
          <label htmlFor="visit-consent" className="text-sm text-graphite">
            {t("consent")}{" "}
            <Link href="/legal/data-policy" className="text-electric underline" target="_blank">
              {t("consentLink")}
            </Link>
            .<span aria-hidden="true" className="text-destructive"> *</span>
          </label>
        </div>
        {fe("consent") ? (
          <p id="visit-consent-error" role="alert" className="text-sm text-destructive">
            {fe("consent")}
          </p>
        ) : null}
      </div>

      <Button type="submit" variant="brand" size="pill-lg" disabled={pending} className="self-start">
        {pending ? t("submitting") : t("submit")}
      </Button>
      <p className="text-xs text-graphite">{ta("recaptchaNotice")}</p>
    </form>
  );
}
