import { z } from "zod";

/**
 * New Client Package (intake, service agreement and documents): shared by the
 * browser (early feedback) and the server (enforcement). Issue messages are
 * keys of the Intake.errors messages. Some answers open follow-up questions;
 * the helpers below decide which ones apply, on both sides.
 */

export const FILING_STATUSES = ["single", "mfj", "mfs", "hoh", "qss", "unsure"] as const;
export const RELATIONSHIPS = ["son", "daughter", "stepchild", "fosterChild", "sibling", "parent", "grandchild", "other"] as const;
export const INCOME_TYPES = [
  "w2",
  "selfEmployment",
  "paymentApps",
  "unemployment",
  "socialSecurity",
  "retirement",
  "interestDividends",
  "rental",
  "k1",
  "cryptoStocks",
  "gambling",
  "other",
] as const;
export const DEDUCTION_TYPES = [
  "mortgage",
  "propertyTax",
  "charity",
  "tuition",
  "studentLoan",
  "childcare",
  "marketplace",
  "retirementContrib",
  "estimatedPayments",
] as const;
export const QUESTIONS = ["irsLetter", "movedState", "homeSale", "fullYearCoverage", "foreignAccounts"] as const;
/** The answer that opens each question's follow-up ("tell us more"). */
export const QUESTION_FOLLOW_UP: Record<(typeof QUESTIONS)[number], "yes" | "no"> = {
  irsLetter: "yes",
  movedState: "yes",
  homeSale: "yes",
  fullYearCoverage: "no",
  foreignAccounts: "yes",
};
export const REFUND_METHODS = ["direct", "check", "applyNext"] as const;
export const REFERRALS = ["friend", "social", "walkIn", "google", "previousClient", "other"] as const;
export const SIGNATURE_METHODS = ["draw", "type", "upload"] as const;
export const DOC_TYPES = ["id", "ssn", "income", "prior_return", "dependents", "deductions", "irs_letters", "other"] as const;

export type FilingStatus = (typeof FILING_STATUSES)[number];
export type DocType = (typeof DOC_TYPES)[number];
export type Question = (typeof QUESTIONS)[number];
export type SignatureMethod = (typeof SIGNATURE_METHODS)[number];

export const MAX_DEPENDENTS = 10;
export const MAX_INTAKE_UPLOADS = 25;
export const MAX_SIGNATURE_BYTES = 300 * 1024;

/** Spouse details apply to married filing statuses, or when "not sure" and married. */
export function needsSpouse(status: string, married?: string): boolean {
  return status === "mfj" || status === "mfs" || (status === "unsure" && married === "yes");
}
/** Both spouses sign only a joint return. */
export function needsSpouseSignature(status: string): boolean {
  return status === "mfj";
}

/** Tax years offered: the last four, most recent first. */
export function taxYearOptions(now = new Date()): number[] {
  const last = now.getFullYear() - 1;
  return [last, last - 1, last - 2, last - 3];
}

const text = (max: number) => z.string().trim().max(max, { error: "tooLong" });
const requiredText = (max: number) => text(max).min(1, { error: "required" });

const isoDate = requiredText(10)
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "dateInvalid" })
  .refine(
    (v) => {
      const d = new Date(`${v}T00:00:00Z`);
      return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(v) && d.getTime() <= Date.now() && d.getUTCFullYear() >= 1900;
    },
    { error: "dateInvalid" },
  );

/** SSN or ITIN, stored as ###-##-####. */
const taxId = requiredText(11)
  .transform((v) => v.replace(/[\s-]/g, ""))
  .refine((v) => /^\d{9}$/.test(v) && !v.startsWith("000") && v.slice(3, 5) !== "00" && v.slice(5) !== "0000", { error: "ssnInvalid" })
  .transform((v) => `${v.slice(0, 3)}-${v.slice(3, 5)}-${v.slice(5)}`);

const phone = requiredText(40).regex(/^[+()\d\s.-]{7,}$/, { error: "phoneInvalid" });
const optionalPhone = text(40).refine((v) => v === "" || /^[+()\d\s.-]{7,}$/.test(v), { error: "phoneInvalid" });
const email = requiredText(254).pipe(z.email({ error: "emailInvalid" }));
const optionalEmail = text(254).refine((v) => v === "" || z.email().safeParse(v).success, { error: "emailInvalid" });
const ipPin = text(6).refine((v) => v === "" || /^\d{6}$/.test(v), { error: "ipPinInvalid" });
const yesNo = z.enum(["yes", "no"], { error: "choose" });

/** ABA routing number checksum. */
export function isRoutingNumber(value: string): boolean {
  if (!/^\d{9}$/.test(value)) return false;
  const d = value.split("").map(Number);
  const sum = 3 * (d[0]! + d[3]! + d[6]!) + 7 * (d[1]! + d[4]! + d[7]!) + (d[2]! + d[5]! + d[8]!);
  return sum % 10 === 0;
}

const person = {
  firstName: requiredText(60),
  middleInitial: text(2),
  lastName: requiredText(60),
  ssn: taxId,
  dob: isoDate,
  ipPin,
  occupation: text(80),
  blind: yesNo,
  claimedByOther: yesNo,
};

export const taxpayerSchema = z.object({
  ...person,
  cellPhone: phone,
  workPhone: optionalPhone,
  email,
  street: requiredText(120),
  apt: text(20),
  city: requiredText(60),
  state: requiredText(2).regex(/^[A-Za-z]{2}$/, { error: "stateInvalid" }).transform((v) => v.toUpperCase()),
  zip: requiredText(10).regex(/^\d{5}(-?\d{4})?$/, { error: "zipInvalid" }),
});

export const spouseSchema = z.object({ ...person, cellPhone: optionalPhone, email: optionalEmail });

export const dependentSchema = z.object({
  fullName: requiredText(120),
  ssn: taxId,
  dob: isoDate,
  relationship: z.enum(RELATIONSHIPS, { error: "choose" }),
  months: z.coerce.number({ error: "invalid" }).int({ error: "invalid" }).min(0, { error: "invalid" }).max(12, { error: "invalid" }),
});

const refundSchema = z.discriminatedUnion(
  "method",
  [
    z.object({ method: z.literal("check") }),
    z.object({ method: z.literal("applyNext") }),
    z.object({
      method: z.literal("direct"),
      bankName: requiredText(80),
      routing: requiredText(9).refine(isRoutingNumber, { error: "routingInvalid" }),
      account: requiredText(17).regex(/^\d{4,17}$/, { error: "accountInvalid" }),
      accountType: z.enum(["checking", "savings"], { error: "choose" }),
    }),
  ],
  { error: "choose" },
);

export const intakeDataSchema = z
  .object({
    taxYear: z.coerce.number({ error: "choose" }).int().min(2000).max(2100),
    preferredLanguage: z.enum(["en", "es"], { error: "choose" }),
    taxpayer: taxpayerSchema,
    filingStatus: z.enum(FILING_STATUSES, { error: "choose" }),
    /** Only asked when the filing status is "not sure". */
    married: z.enum(["yes", "no", ""]).default(""),
    spouse: spouseSchema.nullable(),
    hasDependents: yesNo,
    dependents: z.array(dependentSchema).max(MAX_DEPENDENTS),
    income: z.array(z.enum(INCOME_TYPES)).max(INCOME_TYPES.length),
    businessDescription: text(300),
    otherIncome: text(300),
    deductions: z.array(z.enum(DEDUCTION_TYPES)).max(DEDUCTION_TYPES.length),
    childcareProvider: text(300),
    questions: z.object(Object.fromEntries(QUESTIONS.map((q) => [q, yesNo])) as Record<Question, typeof yesNo>),
    questionDetails: z.object(Object.fromEntries(QUESTIONS.map((q) => [q, text(500)])) as Record<Question, ReturnType<typeof text>>),
    refund: refundSchema,
    referral: z.enum([...REFERRALS, ""]).default(""),
    referralOther: text(120),
    notes: text(2000),
  })
  .superRefine((value, ctx) => {
    if (value.filingStatus === "unsure" && !value.married) ctx.addIssue({ code: "custom", path: ["married"], message: "choose" });
    if (needsSpouse(value.filingStatus, value.married) && !value.spouse) ctx.addIssue({ code: "custom", path: ["spouse"], message: "required" });
    if (value.hasDependents === "yes" && value.dependents.length === 0) ctx.addIssue({ code: "custom", path: ["dependents"], message: "dependentsRequired" });
    if (value.income.includes("other") && !value.otherIncome) ctx.addIssue({ code: "custom", path: ["otherIncome"], message: "required" });
  })
  // Answers to questions that no longer apply are dropped, so they never reach the PDF.
  .transform((value) => ({
    ...value,
    married: value.filingStatus === "unsure" ? value.married : "",
    spouse: needsSpouse(value.filingStatus, value.married) ? value.spouse : null,
    dependents: value.hasDependents === "yes" ? value.dependents : [],
    businessDescription: value.income.includes("selfEmployment") ? value.businessDescription : "",
    otherIncome: value.income.includes("other") ? value.otherIncome : "",
    childcareProvider: value.deductions.includes("childcare") ? value.childcareProvider : "",
    questionDetails: Object.fromEntries(
      QUESTIONS.map((q) => [q, value.questions[q] === QUESTION_FOLLOW_UP[q] ? value.questionDetails[q] : ""]),
    ) as Record<Question, string>,
    referralOther: value.referral === "other" ? value.referralOther : "",
  }));

export type IntakeData = z.output<typeof intakeDataSchema>;

const signatureImage = z.string().max(MAX_SIGNATURE_BYTES * 2);

/** Declaration, service agreement and signatures; checked together with the answers. */
export const intakeSigningSchema = z
  .object({
    filingStatus: z.enum(FILING_STATUSES),
    consent: z.literal(true, { error: "consentRequired" }),
    pub135: z.literal(true, { error: "consentRequired" }),
    agreement: z.literal(true, { error: "consentRequired" }),
    signature: signatureImage.startsWith("data:image/png;base64,", { error: "signatureRequired" }),
    signatureMethod: z.enum(SIGNATURE_METHODS),
    spouseSignature: signatureImage,
    spouseSignatureMethod: z.enum([...SIGNATURE_METHODS, ""]),
  })
  .superRefine((value, ctx) => {
    if (!needsSpouseSignature(value.filingStatus)) return;
    if (!value.spouseSignature.startsWith("data:image/png;base64,") || !value.spouseSignatureMethod) {
      ctx.addIssue({ code: "custom", path: ["spouseSignature"], message: "signatureRequired" });
    }
  });

export const intakeSubmitSchema = z.object({
  data: z.unknown(),
  /** Language the client read the form and the agreement in. */
  locale: z.enum(["en", "es"]),
  consent: z.boolean(),
  pub135: z.boolean(),
  agreement: z.boolean(),
  signature: signatureImage,
  signatureMethod: z.string().max(10),
  spouseSignature: signatureImage,
  spouseSignatureMethod: z.string().max(10),
  uploadIds: z.array(z.uuid()).max(MAX_INTAKE_UPLOADS),
  recaptchaToken: z.string().max(4000).nullish(),
});

export const intakeUploadIntentSchema = z.object({
  name: z.string().min(1).max(255),
  size: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  mime: z.string().max(200),
  docType: z.enum(DOC_TYPES),
});

export const INTAKE_ERROR_KEYS = [
  "required",
  "invalid",
  "tooLong",
  "choose",
  "emailInvalid",
  "phoneInvalid",
  "ssnInvalid",
  "dateInvalid",
  "stateInvalid",
  "zipInvalid",
  "routingInvalid",
  "accountInvalid",
  "ipPinInvalid",
  "consentRequired",
  "signatureRequired",
  "dependentsRequired",
] as const;
export type IntakeErrorKey = (typeof INTAKE_ERROR_KEYS)[number];

/** Maps Zod issues to the first error per dotted path ("taxpayer.ssn", "dependents.0.dob"). */
export function intakeErrorsFrom(error: z.ZodError): Record<string, IntakeErrorKey> {
  const out: Record<string, IntakeErrorKey> = {};
  for (const issue of error.issues) {
    const path = issue.path.map(String).join(".");
    if (out[path]) continue;
    out[path] = (INTAKE_ERROR_KEYS as readonly string[]).includes(issue.message) ? (issue.message as IntakeErrorKey) : "invalid";
  }
  return out;
}

/** "***-**-1234": tax IDs shown on screen; the full value only appears in the staff PDF. */
export function maskTaxId(value: string): string {
  return `***-**-${value.slice(-4)}`;
}

/** Documents worth suggesting given the answers (shown as "recommended" on the upload step). */
export function recommendedDocs(data: { hasDependents: string; income: string[]; deductions: string[]; questions: Record<string, string> }): Set<DocType> {
  const out = new Set<DocType>(["id", "ssn"]);
  if (data.income.length > 0) out.add("income");
  if (data.hasDependents === "yes") out.add("dependents");
  if (data.deductions.length > 0) out.add("deductions");
  if (data.questions.irsLetter === "yes") out.add("irs_letters");
  return out;
}
