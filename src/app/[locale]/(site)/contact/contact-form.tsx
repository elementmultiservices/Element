"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { submitContactAction, type ContactField } from "@/actions/contact";
import { FormAlert } from "@/components/forms/form-alert";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useProtectedAction } from "@/hooks/use-protected-action";
import { Link } from "@/i18n/navigation";

export function ContactForm({ formToken }: { formToken: string }) {
  const t = useTranslations("Contact");
  const tv = useTranslations("Validation");
  const te = useTranslations("Errors");
  const ta = useTranslations("Auth");
  const [formKey, setFormKey] = useState(0);
  const [dismissed, setDismissed] = useState<object | null>(null);
  const { state, onSubmit, pending } = useProtectedAction<ContactField>(submitContactAction, { recaptchaAction: "contact" });
  const fe = (f: ContactField) => (state.fieldErrors?.[f] ? tv(state.fieldErrors[f]) : undefined);

  if (state.status === "success" && state !== dismissed) {
    return (
      <div className="space-y-4">
        <FormAlert variant="success">
          <p className="font-semibold">{t("successTitle")}</p>
          <p>{t("success")}</p>
        </FormAlert>
        <Button
          type="button"
          variant="outline"
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

  return (
    <form key={formKey} onSubmit={onSubmit} noValidate className="space-y-5">
      {state.status === "error" && state.error ? <FormAlert variant="error">{te(state.error)}</FormAlert> : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField name="name" label={t("name")} autoComplete="name" maxLength={120} required error={fe("name")} />
        <FormField name="email" type="email" label={t("email")} autoComplete="email" maxLength={254} required error={fe("email")} />
      </div>
      <FormField name="subject" label={t("subject")} maxLength={200} required error={fe("subject")} />
      <div className="space-y-1.5">
        <Label htmlFor="field-message">
          {t("message")}
          <span aria-hidden="true" className="text-destructive"> *</span>
        </Label>
        <Textarea
          id="field-message"
          name="message"
          rows={6}
          maxLength={5000}
          required
          aria-invalid={fe("message") ? true : undefined}
          aria-describedby={`field-message-hint${fe("message") ? " field-message-error" : ""}`}
        />
        <p id="field-message-hint" className="text-xs text-muted-foreground">
          {t("messageHint")}
        </p>
        {fe("message") ? (
          <p id="field-message-error" role="alert" className="text-sm text-destructive">
            {fe("message")}
          </p>
        ) : null}
      </div>

      <input type="hidden" name="formToken" value={formToken} />
      {/* Honeypot: hidden from people and assistive technology; bots tend to fill it. */}
      <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
        <label htmlFor="field-website">{t("honeypot")}</label>
        <input id="field-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-start gap-3">
          <input
            id="field-consent"
            name="consent"
            type="checkbox"
            required
            aria-invalid={fe("consent") ? true : undefined}
            aria-describedby={fe("consent") ? "field-consent-error" : undefined}
            className="mt-1 size-4 shrink-0 accent-[var(--primary)]"
          />
          <label htmlFor="field-consent" className="text-sm">
            {t("consent")}{" "}
            <Link href="/legal/data-policy" className="text-link underline" target="_blank">
              {t("consentLink")}
            </Link>
            .<span aria-hidden="true" className="text-destructive"> *</span>
          </label>
        </div>
        {fe("consent") ? (
          <p id="field-consent-error" role="alert" className="text-sm text-destructive">
            {fe("consent")}
          </p>
        ) : null}
      </div>

      <SubmitButton pending={pending} label={t("submit")} pendingLabel={t("submitting")} className="w-auto" />
      <p className="text-xs text-muted-foreground">{ta("recaptchaNotice")}</p>
    </form>
  );
}
