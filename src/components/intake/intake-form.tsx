"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, ArrowRight, CheckCircle2, FileUp, Info, Loader2, Plus, Send, Trash2, X } from "lucide-react";
import { Wordmark } from "@/components/brand/wordmark";
import { putWithProgress } from "@/components/files/upload-form";
import { FormAlert } from "@/components/forms/form-alert";
import { FormField } from "@/components/forms/form-field";
import { SignaturePad, type SignatureLabels } from "@/components/intake/signature-pad";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useRecaptcha } from "@/hooks/use-recaptcha";
import { useRouter } from "@/i18n/navigation";
import { formatBytes } from "@/lib/format";
import { checkFileName, FILE_KINDS, MAX_FILE_BYTES } from "@/lib/files/rules";
import { AGREEMENT_CLAUSES } from "@/lib/intake/content";
import {
  DEDUCTION_TYPES,
  DOC_TYPES,
  FILING_STATUSES,
  INCOME_TYPES,
  intakeDataSchema,
  intakeErrorsFrom,
  intakeSigningSchema,
  MAX_DEPENDENTS,
  MAX_INTAKE_UPLOADS,
  needsSpouse,
  needsSpouseSignature,
  QUESTION_FOLLOW_UP,
  QUESTIONS,
  recommendedDocs,
  REFERRALS,
  REFUND_METHODS,
  RELATIONSHIPS,
  type DocType,
  type IntakeErrorKey,
  type SignatureMethod,
} from "@/lib/intake/schema";
import { cn } from "@/lib/utils";

const STEPS = ["you", "family", "income", "questions", "sign", "documents"] as const;
type Step = (typeof STEPS)[number];

/** Which answers each step owns (error paths start with one of these). */
const STEP_FIELDS: Record<Step, string[]> = {
  you: ["taxYear", "preferredLanguage", "taxpayer"],
  family: ["filingStatus", "married", "spouse", "hasDependents", "dependents"],
  income: ["income", "businessDescription", "otherIncome", "deductions", "childcareProvider"],
  questions: ["questions", "questionDetails", "refund", "referral", "referralOther", "notes"],
  sign: ["consent", "pub135", "agreement", "signature", "signatureMethod", "spouseSignature", "spouseSignatureMethod"],
  documents: [],
};

type PersonKey = "firstName" | "middleInitial" | "lastName" | "ssn" | "dob" | "ipPin" | "occupation" | "cellPhone" | "email" | "blind" | "claimedByOther";
type TaxpayerKey = PersonKey | "workPhone" | "street" | "apt" | "city" | "state" | "zip";
const PERSON_KEYS: PersonKey[] = ["firstName", "middleInitial", "lastName", "ssn", "dob", "ipPin", "occupation", "cellPhone", "email", "blind", "claimedByOther"];

type RawDependent = { key: string; fullName: string; ssn: string; dob: string; relationship: string; months: string };

type Raw = {
  taxYear: string;
  preferredLanguage: string;
  taxpayer: Record<TaxpayerKey, string>;
  filingStatus: string;
  married: string;
  spouse: Record<PersonKey, string>;
  hasDependents: string;
  dependents: RawDependent[];
  income: string[];
  businessDescription: string;
  otherIncome: string;
  deductions: string[];
  childcareProvider: string;
  questions: Record<string, string>;
  questionDetails: Record<string, string>;
  refund: { method: string; bankName: string; routing: string; account: string; accountType: string };
  referral: string;
  referralOther: string;
  notes: string;
};

type Signing = {
  consent: boolean;
  pub135: boolean;
  agreement: boolean;
  signature: string;
  signatureMethod: SignatureMethod;
  spouseSignature: string;
  spouseSignatureMethod: SignatureMethod | "";
};

type UploadItem = {
  key: string;
  id: string | null;
  name: string;
  size: number;
  docType: DocType;
  status: "uploading" | "verifying" | "ready" | "error";
  progress: number;
  error?: string;
};

const UPLOAD_ERRORS = new Set([
  "invalid_name",
  "double_extension",
  "type_not_allowed",
  "too_large",
  "empty_file",
  "intake_limit",
  "daily_cap",
  "rate_limited",
  "content_rejected",
  "size_mismatch",
  "upload_missing",
  "intent_invalid",
  "recaptcha_failed",
  "form_expired",
]);

/** Header carrying the public form's draft token (see src/lib/intake/actor.ts). */
const DRAFT_HEADER = "X-Intake-Draft";

const ACCEPT = FILE_KINDS.map((k) => (k === "jpg" ? ".jpg,.jpeg" : `.${k}`)).join(",");
const emptyPerson = (): Record<PersonKey, string> => Object.fromEntries(PERSON_KEYS.map((k) => [k, ""])) as Record<PersonKey, string>;
const newDependent = (): RawDependent => ({ key: crypto.randomUUID(), fullName: "", ssn: "", dob: "", relationship: "", months: "12" });
const today = () => new Date().toISOString().slice(0, 10);

function toPayload(raw: Raw) {
  const { refund } = raw;
  return {
    ...raw,
    spouse: needsSpouse(raw.filingStatus, raw.married) ? raw.spouse : null,
    dependents: raw.hasDependents === "yes" ? raw.dependents.map(({ key: _key, ...d }) => d) : [],
    refund:
      refund.method === "direct"
        ? { method: "direct", bankName: refund.bankName, routing: refund.routing.trim(), account: refund.account.trim(), accountType: refund.accountType }
        : { method: refund.method },
  };
}

function stepOf(path: string): Step {
  const head = path.split(".")[0] ?? "";
  return STEPS.find((s) => STEP_FIELDS[s].includes(head)) ?? "you";
}

/**
 * The New Client Package. In a client's account it is sent as theirs; with a
 * `draftToken` it is the public form (no account): every call carries the
 * token, documents and the final submission get a reCAPTCHA token, a hidden
 * honeypot field is sent along, and a thank-you note replaces the form.
 */
export function IntakeForm({
  taxYears,
  defaults,
  draftToken,
}: {
  taxYears: number[];
  defaults: { firstName: string; lastName: string; email: string };
  draftToken?: string;
}) {
  const t = useTranslations("Intake");
  const locale = useLocale();
  const router = useRouter();
  const isPublic = Boolean(draftToken);
  const getRecaptcha = useRecaptcha({ lazy: !isPublic });
  const [honeypot, setHoneypot] = useState("");
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);

  async function send(url: string, method: "POST" | "DELETE", body?: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
    const res = await fetch(url, {
      method,
      headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...(draftToken ? { [DRAFT_HEADER]: draftToken } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok, data };
  }
  const recaptcha = async (action: "intake_upload" | "intake_submit") => (isPublic ? await getRecaptcha(action) : "");
  const ids = useId();
  const fileRefs = useRef<Partial<Record<DocType, HTMLInputElement | null>>>({});
  const topRef = useRef<HTMLDivElement>(null);

  const [step, setStep] = useState<Step>("you");
  const [raw, setRaw] = useState<Raw>(() => ({
    taxYear: String(taxYears[0]),
    preferredLanguage: locale === "es" ? "es" : "en",
    taxpayer: {
      ...emptyPerson(),
      firstName: defaults.firstName,
      lastName: defaults.lastName,
      email: defaults.email,
      workPhone: "",
      street: "",
      apt: "",
      city: "",
      state: "NY",
      zip: "",
    },
    filingStatus: "",
    married: "",
    spouse: emptyPerson(),
    hasDependents: "",
    dependents: [],
    income: [],
    businessDescription: "",
    otherIncome: "",
    deductions: [],
    childcareProvider: "",
    questions: Object.fromEntries(QUESTIONS.map((q) => [q, ""])),
    questionDetails: Object.fromEntries(QUESTIONS.map((q) => [q, ""])),
    refund: { method: "", bankName: "", routing: "", account: "", accountType: "" },
    referral: "",
    referralOther: "",
    notes: "",
  }));
  const [signing, setSigning] = useState<Signing>({
    consent: false,
    pub135: false,
    agreement: false,
    signature: "",
    signatureMethod: "draw",
    spouseSignature: "",
    spouseSignatureMethod: "",
  });
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [errors, setErrors] = useState<Record<string, IntakeErrorKey>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [dirty, setDirty] = useState(false);

  const stepIndex = STEPS.indexOf(step);
  const spouseShown = needsSpouse(raw.filingStatus, raw.married);
  const spouseSigns = needsSpouseSignature(raw.filingStatus);
  const uploadsBusy = uploads.some((u) => u.status === "uploading" || u.status === "verifying");
  const recommended = useMemo(() => recommendedDocs(raw), [raw]);
  const signedDate = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date()), [locale]);

  // Unsaved answers are lost on reload: ask before leaving.
  useEffect(() => {
    if (!dirty || submitting) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty, submitting]);

  const update = (fn: (draft: Raw) => Raw) => {
    setDirty(true);
    setRaw(fn);
  };
  const set = <K extends keyof Raw>(k: K, v: Raw[K]) => update((r) => ({ ...r, [k]: v }));
  const setTaxpayer = (k: TaxpayerKey, v: string) => update((r) => ({ ...r, taxpayer: { ...r.taxpayer, [k]: v } }));
  const setSpouse = (k: PersonKey, v: string) => update((r) => ({ ...r, spouse: { ...r.spouse, [k]: v } }));
  const setDependent = (i: number, patch: Partial<RawDependent>) =>
    update((r) => ({ ...r, dependents: r.dependents.map((d, j) => (j === i ? { ...d, ...patch } : d)) }));
  const toggle = (list: "income" | "deductions", value: string) =>
    update((r) => ({ ...r, [list]: r[list].includes(value) ? r[list].filter((v) => v !== value) : [...r[list], value] }));

  const err = (path: string) => (errors[path] ? t(`errors.${errors[path]}`) : undefined);

  /** Full validation; returns the errors that belong to `only` (or all). */
  function validate(only?: Step): Record<string, IntakeErrorKey> {
    const data = intakeDataSchema.safeParse(toPayload(raw));
    const sign = intakeSigningSchema.safeParse({ filingStatus: raw.filingStatus || "single", ...signing });
    const all = { ...(data.success ? {} : intakeErrorsFrom(data.error)), ...(sign.success ? {} : intakeErrorsFrom(sign.error)) };
    if (!only) return all;
    return Object.fromEntries(Object.entries(all).filter(([path]) => stepOf(path) === only));
  }

  const scrollTop = () => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  function go(next: Step) {
    setFormError(null);
    setStep(next);
    scrollTop();
  }

  function onNext() {
    const found = validate(step);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setFormError(t("errors.fixErrors"));
      requestAnimationFrame(() => document.querySelector<HTMLElement>("[aria-invalid='true']")?.focus());
      return;
    }
    go(STEPS[stepIndex + 1]!);
  }

  // ---------------------------------------------------------------- uploads
  function addFiles(type: DocType, files: FileList | null) {
    if (!files) return;
    for (const [i, file] of Array.from(files).entries()) {
      if (uploads.length + i >= MAX_INTAKE_UPLOADS) {
        setFormError(t("documents.errors.intake_limit", { max: MAX_INTAKE_UPLOADS }));
        break;
      }
      void uploadOne(file, type);
    }
    const input = fileRefs.current[type];
    if (input) input.value = "";
  }

  async function uploadOne(file: File, type: DocType) {
    const key = crypto.randomUUID();
    const patch = (p: Partial<UploadItem>) => setUploads((list) => list.map((u) => (u.key === key ? { ...u, ...p } : u)));
    setDirty(true);
    setUploads((list) => [...list, { key, id: null, name: file.name, size: file.size, docType: type, status: "uploading", progress: 0 }]);

    const fail = (code: string) => patch({ status: "error", error: UPLOAD_ERRORS.has(code) ? code : "generic" });
    const check = checkFileName(file.name);
    if (!check.ok) return fail(check.reason === "doubleExtension" ? "double_extension" : check.reason === "invalidName" ? "invalid_name" : "type_not_allowed");
    if (file.size === 0) return fail("empty_file");
    if (file.size > MAX_FILE_BYTES) return fail("too_large");

    try {
      const intent = await send("/api/intake/uploads", "POST", {
        name: file.name,
        size: file.size,
        mime: check.mime,
        docType: type,
        recaptchaToken: await recaptcha("intake_upload"),
      });
      if (!intent.ok) return fail(String(intent.data.error));
      const id = String(intent.data.id);
      patch({ id });
      await putWithProgress(String(intent.data.uploadUrl), file, String(intent.data.contentType), (progress) => patch({ progress }));
      patch({ status: "verifying", progress: 1 });
      const confirm = await send(`/api/intake/uploads/${id}`, "POST", {});
      if (!confirm.ok) return fail(String(confirm.data.error));
      patch({ status: "ready" });
    } catch {
      fail("upload_missing");
    }
  }

  async function removeUpload(item: UploadItem) {
    setUploads((list) => list.filter((u) => u.key !== item.key));
    if (item.id && item.status !== "error") {
      await send(`/api/intake/uploads/${item.id}`, "DELETE").catch(() => undefined);
    }
  }

  // ----------------------------------------------------------------- submit
  async function onSubmit() {
    const found = validate();
    setErrors(found);
    const paths = Object.keys(found);
    if (paths.length > 0) {
      setFormError(t("errors.fixErrors"));
      setStep(stepOf(paths[0]!));
      scrollTop();
      return;
    }
    if (uploadsBusy) return setFormError(t("errors.uploadsPending"));

    setSubmitting(true);
    setFormError(null);
    try {
      const res = await send("/api/intake/submit", "POST", {
        data: toPayload(raw),
        locale: locale === "es" ? "es" : "en",
        ...signing,
        spouseSignature: spouseSigns ? signing.spouseSignature : "",
        spouseSignatureMethod: spouseSigns ? signing.spouseSignatureMethod : "",
        uploadIds: uploads.filter((u) => u.status === "ready" && u.id).map((u) => u.id),
        ...(isPublic ? { recaptchaToken: await recaptcha("intake_submit"), website: honeypot } : {}),
      });
      if (res.ok) {
        setDirty(false);
        if (isPublic) {
          setSubmittedRef(String(res.data.reference ?? ""));
          scrollTop();
        } else {
          router.push(`/dashboard/intake/${String(res.data.id)}?submitted=1`);
        }
        return;
      }
      const code = String(res.data.error ?? "");
      if (code === "intake_invalid" && res.data.fields && typeof res.data.fields === "object") {
        const fields = res.data.fields as Record<string, IntakeErrorKey>;
        setErrors(fields);
        const first = Object.keys(fields)[0];
        if (first) setStep(stepOf(first));
        setFormError(t("errors.fixErrors"));
      } else {
        setFormError(t(`errors.${["intake_uploads_invalid", "rate_limited", "recaptcha_failed", "form_expired"].includes(code) ? code : "generic"}` as "errors.generic"));
      }
      scrollTop();
    } catch {
      setFormError(t("errors.generic"));
    } finally {
      setSubmitting(false);
    }
  }

  // ------------------------------------------------------------ view parts
  const card = (title: string, body: React.ReactNode, description?: string) => (
    <section className="space-y-5 rounded-[24px] border border-azure-50 bg-white p-5 sm:p-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {body}
    </section>
  );

  const errorText = (path: string, id?: string) =>
    err(path) ? (
      <p id={id} role="alert" className="text-sm text-destructive">
        {err(path)}
      </p>
    ) : null;

  const selectField = (
    id: string,
    label: string,
    path: string,
    value: string,
    onChange: (v: string) => void,
    options: { value: string; label: string }[],
    { required = true, className }: { required?: boolean; className?: string } = {},
  ) => (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {required ? <span aria-hidden="true" className="text-destructive"> *</span> : null}
      </Label>
      <NativeSelect
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={err(path) ? true : undefined}
        aria-describedby={err(path) ? `${id}-error` : undefined}
        className="bg-background"
      >
        <option value="">{t("choose")}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </NativeSelect>
      {errorText(path, `${id}-error`)}
    </div>
  );

  /** A yes/no question on one line (radio buttons), with its error. */
  const yesNoRow = (key: string, label: string, path: string, value: string, onChange: (v: "yes" | "no") => void) => (
    <fieldset
      key={key}
      aria-invalid={err(path) ? true : undefined}
      className={cn(
        "flex flex-col gap-2 rounded-2xl border px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between",
        err(path) ? "border-destructive" : "border-azure-50",
      )}
    >
      <legend className="sr-only">{label}</legend>
      <p aria-hidden="true" className="text-sm">
        {label}
        <span className="text-destructive"> *</span>
      </p>
      <div className="flex shrink-0 gap-5 text-sm">
        {(["yes", "no"] as const).map((v) => (
          <label key={v} className="flex cursor-pointer items-center gap-2">
            <input type="radio" name={`${ids}-${key}`} value={v} checked={value === v} onChange={() => onChange(v)} className="size-4 accent-electric" />
            {t(`summary.${v}`)}
          </label>
        ))}
      </div>
      {err(path) ? <p role="alert" className="text-sm text-destructive sm:basis-full">{err(path)}</p> : null}
    </fieldset>
  );

  /** Radio choices shown as cards. */
  const choiceCards = (name: string, legend: string, path: string, value: string, options: { value: string; label: string }[], onChange: (v: string) => void, columns = "sm:grid-cols-3") => (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">
        {legend}
        <span aria-hidden="true" className="text-destructive"> *</span>
      </legend>
      <div className={cn("grid gap-2", columns)}>
        {options.map((o) => (
          <label
            key={o.value}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition-colors",
              value === o.value ? "border-electric bg-azure-25" : "border-azure-50 bg-white hover:bg-mist",
            )}
          >
            <input type="radio" name={`${ids}-${name}`} checked={value === o.value} onChange={() => onChange(o.value)} className="size-4 accent-electric" />
            {o.label}
          </label>
        ))}
      </div>
      {errorText(path)}
    </fieldset>
  );

  const checkboxGrid = (list: "income" | "deductions", options: readonly string[]) => (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">{t(`sections.${list}.pick`)}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((o) => {
          const id = `${ids}-${list}-${o}`;
          const checked = raw[list].includes(o);
          return (
            <label
              key={o}
              htmlFor={id}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 text-sm transition-colors",
                checked ? "border-electric bg-azure-25" : "border-azure-50 bg-white hover:bg-mist",
              )}
            >
              <input id={id} type="checkbox" checked={checked} onChange={() => toggle(list, o)} className="mt-0.5 size-4 accent-electric" />
              <span>{t(`${list}.${o}` as "income.w2")}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );

  /** A follow-up text answer that appears under the choice that opened it. */
  const followUp = (id: string, label: string, path: string, value: string, onChange: (v: string) => void, { required = false, hint }: { required?: boolean; hint?: string } = {}) => (
    <div className="space-y-1.5 rounded-2xl border-l-4 border-electric bg-azure-25 p-4 motion-safe:animate-in motion-safe:fade-in">
      <Label htmlFor={id}>
        {label}
        {required ? <span aria-hidden="true" className="text-destructive"> *</span> : null}
      </Label>
      <Textarea
        id={id}
        rows={2}
        maxLength={500}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={err(path) ? true : undefined}
        className="bg-white"
      />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {errorText(path)}
    </div>
  );

  const personFields = (prefix: "taxpayer" | "spouse", values: Record<PersonKey, string>, setValue: (k: PersonKey, v: string) => void) => {
    const own = prefix === "taxpayer";
    const field = (k: PersonKey, label: string, props: Partial<React.ComponentProps<typeof FormField>> & { className: string }) => (
      <FormField
        id={`${ids}-${prefix}-${k}`}
        name={`${prefix}.${k}`}
        label={label}
        value={values[k]}
        onChange={(e) => setValue(k, e.target.value)}
        error={err(`${prefix}.${k}`)}
        {...props}
      />
    );
    return (
      <div className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-6">
          {field("firstName", t("fields.firstName"), { className: "sm:col-span-3", required: true, maxLength: 60, autoComplete: own ? "given-name" : "off" })}
          {field("middleInitial", t("fields.middleInitial"), { className: "sm:col-span-1", maxLength: 2 })}
          {field("lastName", t("fields.lastName"), { className: "sm:col-span-2", required: true, maxLength: 60, autoComplete: own ? "family-name" : "off" })}
          {field("ssn", t("fields.ssn"), { className: "sm:col-span-2", required: true, inputMode: "numeric", autoComplete: "off", maxLength: 11, placeholder: "123-45-6789", hint: t("fields.ssnHint") })}
          {field("dob", t("fields.dob"), { className: "sm:col-span-2", type: "date", required: true, max: today() })}
          {field("ipPin", t("fields.ipPin"), { className: "sm:col-span-2", inputMode: "numeric", autoComplete: "off", maxLength: 6, hint: t("fields.ipPinHint") })}
          {field("occupation", t("fields.occupation"), { className: "sm:col-span-2", maxLength: 80 })}
          {field("cellPhone", t("fields.cellPhone"), { className: "sm:col-span-2", type: "tel", required: own, maxLength: 40, autoComplete: own ? "tel" : "off" })}
          {own ? (
            <FormField
              className="sm:col-span-2"
              id={`${ids}-taxpayer-workPhone`}
              name="taxpayer.workPhone"
              type="tel"
              label={t("fields.workPhone")}
              maxLength={40}
              value={raw.taxpayer.workPhone}
              onChange={(e) => setTaxpayer("workPhone", e.target.value)}
              error={err("taxpayer.workPhone")}
            />
          ) : null}
          {field("email", t("fields.email"), { className: own ? "sm:col-span-6" : "sm:col-span-2", type: "email", required: own, maxLength: 254, autoComplete: own ? "email" : "off" })}
        </div>
        {own ? (
          <div className="grid gap-5 sm:grid-cols-6">
            {(
              [
                ["street", "sm:col-span-4", { required: true, maxLength: 120, autoComplete: "address-line1" }],
                ["apt", "sm:col-span-2", { maxLength: 20, autoComplete: "address-line2" }],
                ["city", "sm:col-span-3", { required: true, maxLength: 60, autoComplete: "address-level2" }],
                ["state", "sm:col-span-1", { required: true, maxLength: 2, autoComplete: "address-level1" }],
                ["zip", "sm:col-span-2", { required: true, maxLength: 10, inputMode: "numeric", autoComplete: "postal-code" }],
              ] as const
            ).map(([k, className, props]) => (
              <FormField
                key={k}
                className={className}
                id={`${ids}-taxpayer-${k}`}
                name={`taxpayer.${k}`}
                label={t(`fields.${k}`)}
                value={raw.taxpayer[k]}
                onChange={(e) => setTaxpayer(k, k === "state" ? e.target.value.toUpperCase() : e.target.value)}
                error={err(`taxpayer.${k}`)}
                {...props}
              />
            ))}
          </div>
        ) : null}
        <div className="space-y-2">
          {yesNoRow(`${prefix}-blind`, t(`fields.${own ? "blind" : "spouseBlind"}`), `${prefix}.blind`, values.blind, (v) => setValue("blind", v))}
          {yesNoRow(
            `${prefix}-claimed`,
            t(`fields.${own ? "claimedByOther" : "spouseClaimedByOther"}`),
            `${prefix}.claimedByOther`,
            values.claimedByOther,
            (v) => setValue("claimedByOther", v),
          )}
        </div>
      </div>
    );
  };

  const signatureLabels: SignatureLabels = {
    draw: t("sign.methods.draw"),
    type: t("sign.methods.type"),
    upload: t("sign.methods.upload"),
    clear: t("sign.clear"),
    drawHint: t("sign.drawHint"),
    typeLabel: t("sign.typeLabel"),
    typeHint: t("sign.typeHint"),
    uploadButton: t("sign.uploadButton"),
    uploadHint: t("sign.uploadHint"),
    uploadError: t("sign.uploadError"),
  };
  const fullName = (p: { firstName: string; middleInitial: string; lastName: string }) => [p.firstName, p.middleInitial, p.lastName].filter(Boolean).join(" ");
  const steps = useMemo(() => STEPS.map((s) => ({ key: s, label: t(`steps.${s}`) })), [t]);

  if (submittedRef !== null) {
    return (
      <div ref={topRef} className="scroll-mt-24 space-y-4 rounded-[24px] border border-azure-50 bg-white p-6 sm:p-8" role="status">
        <CheckCircle2 aria-hidden="true" className="size-10 text-success" />
        <h2 className="text-2xl font-semibold text-ink">{t("public.submittedTitle")}</h2>
        <p className="text-graphite">{t("public.submittedBody", { reference: submittedRef })}</p>
        <p className="text-sm text-muted-foreground">{t("documents.next")}</p>
      </div>
    );
  }

  return (
    <div ref={topRef} className="scroll-mt-24 space-y-6">
      {isPublic ? (
        // Honeypot: hidden from people and assistive technology; bots fill it in.
        <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
          <label>
            Website
            <input type="text" name="website" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
          </label>
        </div>
      ) : null}
      {/* Same band as the paper form: official logo and the form's parts. */}
      <div className="flex flex-col gap-4 rounded-[24px] bg-[linear-gradient(180deg,#050D29_0%,#0B1A44_100%)] px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <Wordmark inverted className="h-9" />
        <div className="sm:text-right">
          <p className="font-semibold text-white">{t("new.title")}</p>
          <p className="text-sm text-azure-300">{t("pdf.packageParts")}</p>
        </div>
      </div>

      <ol aria-label={t("nav.progress")} className="flex gap-1.5 overflow-x-auto pb-1">
        {steps.map((s, i) => (
          <li key={s.key} className="min-w-[92px] flex-1">
            <div className={cn("h-1.5 rounded-full", i <= stepIndex ? "bg-electric" : "bg-azure-50")} />
            <p aria-current={i === stepIndex ? "step" : undefined} className={cn("mt-2 text-xs", i === stepIndex ? "font-semibold text-ink" : "text-muted-foreground")}>
              {i + 1}. {s.label}
            </p>
          </li>
        ))}
      </ol>

      {formError ? <FormAlert variant="error">{formError}</FormAlert> : null}

      {/* 1 · Taxpayer --------------------------------------------------- */}
      {step === "you" ? (
        <>
          {card(
            t("sections.general.title"),
            <div className="grid gap-5 sm:grid-cols-2">
              {selectField(`${ids}-taxYear`, t("fields.taxYear"), "taxYear", raw.taxYear, (v) => set("taxYear", v), taxYears.map((y) => ({ value: String(y), label: String(y) })))}
              {selectField(
                `${ids}-language`,
                t("fields.preferredLanguage"),
                "preferredLanguage",
                raw.preferredLanguage,
                (v) => set("preferredLanguage", v),
                (["es", "en"] as const).map((l) => ({ value: l, label: t(`languages.${l}`) })),
              )}
            </div>,
            t("sections.general.body"),
          )}
          {card(t("sections.taxpayer.title"), personFields("taxpayer", raw.taxpayer, setTaxpayer))}
        </>
      ) : null}

      {/* 2 · Filing status, spouse and dependents ------------------------- */}
      {step === "family" ? (
        <>
          {card(
            t("sections.filingStatus.title"),
            <div className="space-y-4">
              {choiceCards(
                "filingStatus",
                t("fields.filingStatus"),
                "filingStatus",
                raw.filingStatus,
                FILING_STATUSES.map((s) => ({ value: s, label: t(`filingStatus.${s}`) })),
                (v) => set("filingStatus", v),
              )}
              {raw.filingStatus === "unsure" ? (
                <div className="space-y-2 motion-safe:animate-in motion-safe:fade-in">
                  {yesNoRow("married", t("fields.married"), "married", raw.married, (v) => set("married", v))}
                  <p className="flex gap-2 text-xs text-muted-foreground">
                    <Info aria-hidden="true" className="size-4 shrink-0" />
                    {t("sections.filingStatus.unsureNote")}
                  </p>
                </div>
              ) : null}
            </div>,
            t("sections.filingStatus.body"),
          )}
          {spouseShown ? card(t("sections.spouse.title"), personFields("spouse", raw.spouse, setSpouse), t("sections.spouse.body")) : null}
          {card(
            t("sections.dependents.title"),
            <div className="space-y-4">
              {yesNoRow("hasDependents", t("fields.hasDependents"), "hasDependents", raw.hasDependents, (v) =>
                update((r) => ({ ...r, hasDependents: v, dependents: v === "yes" && r.dependents.length === 0 ? [newDependent()] : r.dependents })),
              )}
              {raw.hasDependents === "yes" ? (
                <>
                  {raw.dependents.map((d, i) => {
                    const p = `dependents.${i}`;
                    const base = `${ids}-dep-${d.key}`;
                    return (
                      <fieldset key={d.key} className="space-y-4 rounded-2xl border border-azure-50 bg-mist p-4">
                        <div className="flex items-center justify-between gap-2">
                          <legend className="font-medium">{t("dependents.title", { n: i + 1 })}</legend>
                          <Button type="button" variant="ghost" size="sm" onClick={() => update((r) => ({ ...r, dependents: r.dependents.filter((x) => x.key !== d.key) }))}>
                            <Trash2 aria-hidden="true" />
                            {t("dependents.remove")}
                          </Button>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <FormField className="sm:col-span-2" id={`${base}-name`} name={`${p}.fullName`} label={t("fields.fullName")} required maxLength={120} value={d.fullName} onChange={(e) => setDependent(i, { fullName: e.target.value })} error={err(`${p}.fullName`)} />
                          <FormField id={`${base}-ssn`} name={`${p}.ssn`} label={t("fields.ssn")} required inputMode="numeric" autoComplete="off" maxLength={11} placeholder="123-45-6789" value={d.ssn} onChange={(e) => setDependent(i, { ssn: e.target.value })} error={err(`${p}.ssn`)} />
                          <FormField id={`${base}-dob`} name={`${p}.dob`} type="date" label={t("fields.dob")} required max={today()} value={d.dob} onChange={(e) => setDependent(i, { dob: e.target.value })} error={err(`${p}.dob`)} />
                          {selectField(`${base}-rel`, t("fields.relationship"), `${p}.relationship`, d.relationship, (v) => setDependent(i, { relationship: v }), RELATIONSHIPS.map((r) => ({ value: r, label: t(`relationships.${r}`) })))}
                          <FormField id={`${base}-months`} name={`${p}.months`} type="number" min={0} max={12} label={t("fields.months")} required value={d.months} onChange={(e) => setDependent(i, { months: e.target.value })} error={err(`${p}.months`)} />
                        </div>
                      </fieldset>
                    );
                  })}
                  {errorText("dependents")}
                  {raw.dependents.length < MAX_DEPENDENTS ? (
                    <Button type="button" variant="outline" onClick={() => update((r) => ({ ...r, dependents: [...r.dependents, newDependent()] }))}>
                      <Plus aria-hidden="true" />
                      {t("dependents.add")}
                    </Button>
                  ) : null}
                </>
              ) : null}
            </div>,
            t("sections.dependents.body"),
          )}
        </>
      ) : null}

      {/* 3 · Income and deductions --------------------------------------- */}
      {step === "income" ? (
        <>
          {card(
            t("sections.income.title"),
            <div className="space-y-4">
              {checkboxGrid("income", INCOME_TYPES)}
              {raw.income.includes("selfEmployment")
                ? followUp(`${ids}-business`, t("fields.businessDescription"), "businessDescription", raw.businessDescription, (v) => set("businessDescription", v), {
                    hint: t("fields.businessDescriptionHint"),
                  })
                : null}
              {raw.income.includes("other")
                ? followUp(`${ids}-otherIncome`, t("fields.otherIncome"), "otherIncome", raw.otherIncome, (v) => set("otherIncome", v), { required: true })
                : null}
            </div>,
            t("sections.income.body"),
          )}
          {card(
            t("sections.deductions.title"),
            <div className="space-y-4">
              {checkboxGrid("deductions", DEDUCTION_TYPES)}
              {raw.deductions.includes("childcare")
                ? followUp(`${ids}-childcare`, t("fields.childcareProvider"), "childcareProvider", raw.childcareProvider, (v) => set("childcareProvider", v), {
                    hint: t("fields.childcareProviderHint"),
                  })
                : null}
            </div>,
            t("sections.deductions.body"),
          )}
        </>
      ) : null}

      {/* 4 · Questions, refund and referral ------------------------------ */}
      {step === "questions" ? (
        <>
          {card(
            t("sections.questions.title"),
            <div className="space-y-2">
              {QUESTIONS.map((q) => (
                <div key={q} className="space-y-2">
                  {yesNoRow(q, t(`questions.${q}`), `questions.${q}`, raw.questions[q] ?? "", (v) => update((r) => ({ ...r, questions: { ...r.questions, [q]: v } })))}
                  {raw.questions[q] === QUESTION_FOLLOW_UP[q]
                    ? followUp(`${ids}-detail-${q}`, t(`followUps.${q}`), `questionDetails.${q}`, raw.questionDetails[q] ?? "", (v) =>
                        update((r) => ({ ...r, questionDetails: { ...r.questionDetails, [q]: v } })),
                      )
                    : null}
                </div>
              ))}
            </div>,
          )}
          {card(
            t("sections.refund.title"),
            <div className="space-y-5">
              {choiceCards(
                "refund",
                t("fields.refundMethod"),
                "refund.method",
                raw.refund.method,
                REFUND_METHODS.map((m) => ({ value: m, label: t(`refund.${m}`) })),
                (m) => update((r) => ({ ...r, refund: { ...r.refund, method: m } })),
              )}
              {raw.refund.method === "direct" ? (
                <div className="grid gap-5 rounded-2xl border-l-4 border-electric bg-azure-25 p-4 sm:grid-cols-2 motion-safe:animate-in motion-safe:fade-in">
                  <FormField className="sm:col-span-2" id={`${ids}-bank`} name="refund.bankName" label={t("fields.bankName")} required maxLength={80} value={raw.refund.bankName} onChange={(e) => update((r) => ({ ...r, refund: { ...r.refund, bankName: e.target.value } }))} error={err("refund.bankName")} />
                  <FormField id={`${ids}-routing`} name="refund.routing" label={t("fields.routing")} required inputMode="numeric" autoComplete="off" maxLength={9} value={raw.refund.routing} onChange={(e) => update((r) => ({ ...r, refund: { ...r.refund, routing: e.target.value } }))} error={err("refund.routing")} />
                  <FormField id={`${ids}-account`} name="refund.account" label={t("fields.account")} required inputMode="numeric" autoComplete="off" maxLength={17} value={raw.refund.account} onChange={(e) => update((r) => ({ ...r, refund: { ...r.refund, account: e.target.value } }))} error={err("refund.account")} />
                  <div className="sm:col-span-2">
                    {choiceCards(
                      "accountType",
                      t("fields.accountType"),
                      "refund.accountType",
                      raw.refund.accountType,
                      (["checking", "savings"] as const).map((a) => ({ value: a, label: t(`refund.${a}`) })),
                      (v) => update((r) => ({ ...r, refund: { ...r.refund, accountType: v } })),
                      "sm:grid-cols-2",
                    )}
                  </div>
                </div>
              ) : null}
            </div>,
            t("sections.refund.body"),
          )}
          {card(
            t("sections.referral.title"),
            <div className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-3">
                {REFERRALS.map((o) => (
                  <label
                    key={o}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition-colors",
                      raw.referral === o ? "border-electric bg-azure-25" : "border-azure-50 bg-white hover:bg-mist",
                    )}
                  >
                    <input type="radio" name={`${ids}-referral`} checked={raw.referral === o} onChange={() => set("referral", o)} className="size-4 accent-electric" />
                    {t(`referrals.${o}`)}
                  </label>
                ))}
              </div>
              {raw.referral === "other" ? (
                <FormField id={`${ids}-referralOther`} name="referralOther" label={t("fields.referralOther")} maxLength={120} value={raw.referralOther} onChange={(e) => set("referralOther", e.target.value)} error={err("referralOther")} />
              ) : null}
              <div className="space-y-1.5">
                <Label htmlFor={`${ids}-notes`}>{t("fields.notes")}</Label>
                <Textarea id={`${ids}-notes`} rows={3} maxLength={2000} value={raw.notes} onChange={(e) => set("notes", e.target.value)} />
              </div>
            </div>,
          )}
        </>
      ) : null}

      {/* 5 · Declaration, agreement and signatures ------------------------ */}
      {step === "sign" ? (
        <>
          {card(
            t("sign.declarationTitle"),
            <div className="space-y-3">
              <p className="rounded-2xl bg-mist p-4 text-sm leading-relaxed text-graphite">{t("sign.declaration")}</p>
              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" className="mt-0.5 size-4 accent-electric" checked={signing.consent} aria-invalid={err("consent") ? true : undefined} onChange={(e) => setSigning((s) => ({ ...s, consent: e.target.checked }))} />
                <span>
                  {t("sign.consent")}
                  <span aria-hidden="true" className="text-destructive"> *</span>
                </span>
              </label>
              {errorText("consent")}
            </div>,
          )}
          {card(
            t("agreement.title"),
            <div className="space-y-4">
              <div tabIndex={0} aria-label={t("agreement.title")} className="max-h-80 space-y-3 overflow-y-auto rounded-2xl border border-azure-50 bg-mist p-4 text-sm leading-relaxed text-graphite">
                <p>{t("agreement.intro")}</p>
                <ol className="space-y-3">
                  {AGREEMENT_CLAUSES.map((k, i) => (
                    <li key={k}>
                      <p className="font-semibold text-ink">
                        {i + 1}. {t(`agreement.clauses.${k}.title`)}
                      </p>
                      <p>{t(`agreement.clauses.${k}.body`)}</p>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="space-y-2">
                {(["pub135", "agreement"] as const).map((k) => (
                  <div key={k}>
                    <label className="flex items-start gap-3 text-sm">
                      <input type="checkbox" className="mt-0.5 size-4 accent-electric" checked={signing[k]} aria-invalid={err(k) ? true : undefined} onChange={(e) => setSigning((s) => ({ ...s, [k]: e.target.checked }))} />
                      <span>
                        {t(`sign.${k}`)}
                        <span aria-hidden="true" className="text-destructive"> *</span>
                      </span>
                    </label>
                    {errorText(k)}
                  </div>
                ))}
              </div>
            </div>,
            t("agreement.body"),
          )}
          {card(
            t("sign.signaturesTitle"),
            <div className="space-y-6">
              <div className="grid gap-8 lg:grid-cols-2">
                <div className="space-y-2">
                  <SignaturePad
                    id={`${ids}-signature`}
                    label={t("sign.signature", { name: fullName(raw.taxpayer) })}
                    defaultName={fullName(raw.taxpayer)}
                    labels={signatureLabels}
                    invalid={Boolean(err("signature"))}
                    describedBy={err("signature") ? `${ids}-signature-error` : undefined}
                    onChange={(signature, signatureMethod) => setSigning((s) => ({ ...s, signature, signatureMethod }))}
                  />
                  {errorText("signature", `${ids}-signature-error`)}
                  <p className="text-xs text-muted-foreground">{t("sign.date", { date: signedDate })}</p>
                </div>
                {spouseSigns ? (
                  <div className="space-y-2">
                    <SignaturePad
                      id={`${ids}-spouseSignature`}
                      label={t("sign.spouseSignature", { name: fullName(raw.spouse) })}
                      defaultName={fullName(raw.spouse)}
                      labels={signatureLabels}
                      invalid={Boolean(err("spouseSignature"))}
                      describedBy={err("spouseSignature") ? `${ids}-spouseSignature-error` : undefined}
                      onChange={(spouseSignature, spouseSignatureMethod) => setSigning((s) => ({ ...s, spouseSignature, spouseSignatureMethod }))}
                    />
                    {errorText("spouseSignature", `${ids}-spouseSignature-error`)}
                    <p className="text-xs text-muted-foreground">{t("sign.date", { date: signedDate })}</p>
                  </div>
                ) : null}
              </div>
            </div>,
            t("sign.signaturesBody"),
          )}
        </>
      ) : null}

      {/* 6 · Documents (optional) ----------------------------------------- */}
      {step === "documents" ? (
        <>
          {card(
            t("sections.documents.title"),
            <div className="space-y-3">
              {DOC_TYPES.map((d) => {
                const files = uploads.filter((u) => u.docType === d);
                return (
                  <div key={d} className="rounded-2xl bg-mist p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                          {t(`docTypes.${d}`)}
                          {recommended.has(d) ? <span className="rounded-full bg-electric/10 px-2 py-0.5 text-[11px] font-semibold text-electric">{t("documents.recommended")}</span> : null}
                        </p>
                        <p className="text-xs text-muted-foreground">{t(`docHints.${d}`)}</p>
                      </div>
                      <input
                        ref={(el) => {
                          fileRefs.current[d] = el;
                        }}
                        id={`${ids}-files-${d}`}
                        type="file"
                        multiple
                        accept={ACCEPT}
                        className="sr-only"
                        onChange={(e) => addFiles(d, e.target.files)}
                      />
                      <Button type="button" variant="outline" size="sm" className="shrink-0 bg-white" onClick={() => fileRefs.current[d]?.click()} disabled={uploads.length >= MAX_INTAKE_UPLOADS}>
                        <FileUp aria-hidden="true" />
                        {t("documents.add")}
                        <span className="sr-only">: {t(`docTypes.${d}`)}</span>
                      </Button>
                    </div>
                    {files.length > 0 ? (
                      <ul className="mt-3 divide-y rounded-xl border border-azure-50 bg-white" aria-live="polite">
                        {files.map((u) => (
                          <li key={u.key} className="flex items-center gap-3 px-3 py-2">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{u.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatBytes(u.size, locale)} ·{" "}
                                <span className={cn(u.status === "error" && "text-destructive", u.status === "ready" && "text-success")}>
                                  {u.status === "error"
                                    ? t(`documents.errors.${u.error ?? "generic"}` as "documents.errors.generic", { max: formatBytes(MAX_FILE_BYTES, locale) })
                                    : u.status === "uploading"
                                      ? t("documents.uploading", { percent: Math.round(u.progress * 100) })
                                      : t(`documents.${u.status}`)}
                                </span>
                              </p>
                            </div>
                            {u.status === "uploading" || u.status === "verifying" ? (
                              <Loader2 aria-hidden="true" className="size-4 animate-spin text-electric" />
                            ) : u.status === "ready" ? (
                              <CheckCircle2 aria-hidden="true" className="size-4 text-success" />
                            ) : null}
                            <Button type="button" variant="ghost" size="icon-sm" disabled={u.status === "uploading" || u.status === "verifying"} onClick={() => void removeUpload(u)}>
                              <X aria-hidden="true" />
                              <span className="sr-only">{t("documents.remove", { name: u.name })}</span>
                            </Button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                );
              })}
              <p className="text-xs text-muted-foreground">{t("documents.hint", { max: formatBytes(MAX_FILE_BYTES, locale), count: MAX_INTAKE_UPLOADS })}</p>
            </div>,
            t("sections.documents.body"),
          )}
          <FormAlert variant="info">{t("documents.next")}</FormAlert>
        </>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {stepIndex > 0 ? (
          <Button type="button" variant="outline" onClick={() => go(STEPS[stepIndex - 1]!)} disabled={submitting}>
            <ArrowLeft aria-hidden="true" />
            {t("nav.back")}
          </Button>
        ) : (
          <span />
        )}
        {step === "documents" ? (
          <Button type="button" size="lg" onClick={() => void onSubmit()} disabled={submitting || uploadsBusy}>
            {submitting ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Send aria-hidden="true" />}
            {submitting ? t("nav.submitting") : uploads.some((u) => u.status === "ready") ? t("nav.submit") : t("nav.submitWithout")}
          </Button>
        ) : (
          <Button type="button" onClick={onNext}>
            {step === "sign" ? t("nav.signAndContinue") : t("nav.next")}
            <ArrowRight aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  );
}
