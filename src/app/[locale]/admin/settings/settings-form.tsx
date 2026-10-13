"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { CalendarClock, Clock, Megaphone, MapPin, Phone } from "lucide-react";
import { toast } from "sonner";
import { updateSiteSettingsAction } from "@/actions/admin-settings";
import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useProtectedAction } from "@/hooks/use-protected-action";
import { useRouter } from "@/i18n/navigation";
import type { SiteSettingsField } from "@/lib/validation/admin";

export type SettingsValues = {
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  mapsUrl: string;
  bookingUrl: string;
  hoursRegularEs: string;
  hoursRegularEn: string;
  hoursSeasonEs: string;
  hoursSeasonEn: string;
  announcementEnabled: boolean;
  announcementLabelEs: string;
  announcementLabelEn: string;
  announcementTextEs: string;
  announcementTextEn: string;
};

function Section({ icon: Icon, title, hint, children }: { icon: typeof Phone; title: string; hint: string; children: ReactNode }) {
  return (
    <section className="grid gap-6 rounded-[24px] border border-azure-50 bg-white p-6 lg:grid-cols-[260px_1fr] lg:p-8">
      <div className="flex flex-col gap-2">
        <span className="flex size-10 items-center justify-center rounded-full bg-azure-25 text-electric">
          <Icon aria-hidden="true" className="size-[18px]" />
        </span>
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        <p className="text-sm text-graphite">{hint}</p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function SettingsForm({ values, stored }: { values: SettingsValues; stored: boolean }) {
  const t = useTranslations("Admin.settings");
  const tv = useTranslations("Validation");
  const te = useTranslations("Errors");
  const router = useRouter();
  const { state, onSubmit, pending } = useProtectedAction<SiteSettingsField>(updateSiteSettingsAction, {
    onSuccess: () => {
      toast.success(t("saved"));
      router.refresh();
    },
  });
  const fe = (f: SiteSettingsField) => (state.fieldErrors?.[f] ? tv(state.fieldErrors[f]) : undefined);

  const field = (name: SiteSettingsField, options: { type?: string; placeholder?: string; wide?: boolean; hint?: "whatsapp" | "mapsUrl" | "bookingUrl"; maxLength: number }) => {
    const id = `settings-${name}`;
    const error = fe(name);
    const hintId = options.hint ? `${id}-hint` : undefined;
    return (
      <div className={options.wide ? "space-y-1.5 sm:col-span-2" : "space-y-1.5"}>
        <Label htmlFor={id}>{t(`fields.${name}`)}</Label>
        <Input
          id={id}
          name={name}
          type={options.type ?? "text"}
          defaultValue={values[name] as string}
          placeholder={options.placeholder}
          maxLength={options.maxLength}
          aria-invalid={error ? true : undefined}
          aria-describedby={[hintId, error ? `${id}-error` : undefined].filter(Boolean).join(" ") || undefined}
        />
        {options.hint ? (
          <p id={hintId} className="text-xs text-graphite">
            {t(`hints.${options.hint}`)}
          </p>
        ) : null}
        {error ? (
          <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    );
  };

  const area = (name: SiteSettingsField, lang: "es" | "en") => {
    const id = `settings-${name}`;
    const error = fe(name);
    return (
      <div className="space-y-1.5">
        <Label htmlFor={id}>
          {t(`fields.${name}`)} <span className="font-mono text-xs text-graphite uppercase">{lang}</span>
        </Label>
        <Textarea
          id={id}
          name={name}
          lang={lang}
          rows={4}
          maxLength={1000}
          defaultValue={values[name] as string}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        {error ? (
          <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {!stored ? <FormAlert variant="info">{t("migrationNotice")}</FormAlert> : null}
      {state.status === "error" && state.error ? <FormAlert variant="error">{te(state.error)}</FormAlert> : null}

      <Section icon={Phone} title={t("sections.contact.title")} hint={t("sections.contact.hint")}>
        {field("phone", { type: "tel", placeholder: "+1 (917) 890-0892", maxLength: 40 })}
        {field("whatsapp", { type: "tel", placeholder: "19178900892", hint: "whatsapp", maxLength: 20 })}
        {field("email", { type: "email", placeholder: "hola@element…", wide: true, maxLength: 254 })}
      </Section>

      <Section icon={MapPin} title={t("sections.location.title")} hint={t("sections.location.hint")}>
        {field("address", { wide: true, maxLength: 300 })}
        {field("mapsUrl", { type: "url", placeholder: "https://maps.app.goo.gl/…", wide: true, hint: "mapsUrl", maxLength: 1000 })}
      </Section>

      <Section icon={Clock} title={t("sections.hours.title")} hint={t("sections.hours.hint")}>
        {area("hoursRegularEs", "es")}
        {area("hoursRegularEn", "en")}
        {area("hoursSeasonEs", "es")}
        {area("hoursSeasonEn", "en")}
      </Section>

      <Section icon={CalendarClock} title={t("sections.booking.title")} hint={t("sections.booking.hint")}>
        {field("bookingUrl", { type: "url", placeholder: "https://calendly.com/…", wide: true, hint: "bookingUrl", maxLength: 1000 })}
      </Section>

      <Section icon={Megaphone} title={t("sections.announcement.title")} hint={t("sections.announcement.hint")}>
        <label className="flex items-center gap-3 rounded-2xl bg-azure-25 px-4 py-3 text-sm font-medium text-ink sm:col-span-2">
          <input
            type="checkbox"
            name="announcementEnabled"
            defaultChecked={values.announcementEnabled}
            className="size-4 accent-[var(--brand-electric)]"
          />
          {t("fields.announcementEnabled")}
        </label>
        {field("announcementLabelEs", { placeholder: "15 OCT", maxLength: 40 })}
        {field("announcementLabelEn", { placeholder: "OCT 15", maxLength: 40 })}
        {field("announcementTextEs", { wide: true, maxLength: 200 })}
        {field("announcementTextEn", { wide: true, maxLength: 200 })}
      </Section>

      <div className="sticky bottom-4 z-10 flex justify-end">
        <SubmitButton pending={pending} label={t("save")} pendingLabel={t("saving")} className="w-auto px-8 shadow-[0_12px_30px_rgba(27,131,244,0.35)]" />
      </div>
    </form>
  );
}
