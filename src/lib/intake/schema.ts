import { z } from "zod";
import {
  ACCOUNTING_METHODS,
  ASSET_STATUSES,
  C_DUE_DILIGENCE,
  C_EXPENSES,
  C_FLAGS,
  C_SHARED,
  CLAIMABLE,
  COGS_LINES,
  E_DUE_DILIGENCE,
  E_EXPENSES,
  E_FLAGS,
  E_INCOME,
  E_PROPERTY_FLAGS,
  HOME_OFFICE_METHODS,
  HOUSING,
  INCOME_RECORDS,
  MARITAL_STATUSES,
  MAX_BUSINESSES,
  MAX_PROPERTIES,
  MILEAGE_LOGS,
  OWNERS_C,
  OWNERS_E,
  PROPERTY_LETTERS,
  PROPERTY_TYPES,
  VEHICLE_COSTS,
  VEHICLE_METHODS,
} from "./sheet";

/**
 * New Client Package (intake, service agreement and documents): shared by the
 * browser (early feedback) and the server (enforcement). Issue messages are
 * keys of the Intake.errors messages. Some answers open follow-up questions;
 * the helpers below decide which ones apply, on both sides. Self-employment
 * opens the Schedule C sheet (one per business) and rentals, royalties or
 * K-1s open the Schedule E sheet.
 */

export const FILING_STATUSES = ["single", "mfj", "mfs", "hoh", "qss", "unsure"] as const;
export const RELATIONSHIPS = ["son", "daughter", "stepchild", "fosterChild", "sibling", "parent", "grandchild", "other"] as const;
/** Income choices offered, in the order of the paper sheet. */
export const INCOME_TYPES = [
  "w2",
  "selfEmployment",
  "necMisc",
  "paymentApps",
  "unemployment",
  "interestDividends",
  "retirement",
  "rental",
  "royalties",
  "k1",
  "gambling",
  "alimony",
  "foreign",
  "cryptoStocks",
  "other",
] as const;
/** Choices of older forms, still accepted so stored answers keep their meaning. */
const LEGACY_INCOME = ["socialSecurity"] as const;
export const DEDUCTION_TYPES = [
  "childcare",
  "tuition",
  "marketplace",
  "home",
  "estimatedPayments",
  "retirementContrib",
  "teacher",
  "carLoan",
  "charity",
] as const;
const LEGACY_DEDUCTIONS = ["mortgage", "propertyTax", "studentLoan"] as const;
export const MAX_CHILDCARE_PROVIDERS = 4;
export const MAX_ASSETS = 4;
export const MAX_IMPROVEMENTS = 4;
export const MAX_K1S = 3;
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
export const MAX_FACE_PHOTO_BYTES = 400 * 1024;
export const FACE_PHOTO_PREFIX = "data:image/jpeg;base64,";

/** Spouse details apply to married filing statuses, or when "not sure" and married. */
export function needsSpouse(status: string, married?: string): boolean {
  return status === "mfj" || status === "mfs" || (status === "unsure" && married === "yes");
}
/** "yes" when the marital status on December 31 is married (answers the old "are you married?"). */
export function marriedFrom(maritalStatus: string): "yes" | "no" | "" {
  return maritalStatus === "married" ? "yes" : maritalStatus ? "no" : "";
}
type IncomeAnswers = { income: readonly string[]; incomeDetails?: { necIsBusiness?: string; kIsBusiness?: string } };
/** Self-employment, or a 1099-NEC/1099-K that comes from a business, opens the Schedule C sheet. */
export function needsScheduleC(d: IncomeAnswers): boolean {
  return (
    d.income.includes("selfEmployment") ||
    (d.income.includes("necMisc") && d.incomeDetails?.necIsBusiness === "yes") ||
    (d.income.includes("paymentApps") && d.incomeDetails?.kIsBusiness === "yes")
  );
}
/** Rental property, royalties or K-1s open the Schedule E sheet. */
export function needsScheduleE(d: IncomeAnswers): boolean {
  return d.income.includes("rental") || d.income.includes("royalties") || d.income.includes("k1");
}
/** Rentals and royalties are reported per property (royalties as type 6). */
export function needsProperties(d: IncomeAnswers): boolean {
  return d.income.includes("rental") || d.income.includes("royalties");
}
/** A qualifying surviving spouse gives the late spouse's identity and date of death. */
export function needsDeceasedSpouse(status: string): boolean {
  return status === "qss";
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

const isPastDate = (v: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(v) && d.getTime() <= Date.now() && d.getUTCFullYear() >= 1900;
};
const isoDate = requiredText(10)
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "dateInvalid" })
  .refine(isPastDate, { error: "dateInvalid" });

// Optional answers of the sheets: empty when not given.
const optText = (max: number) => text(max).default("");
const optDate = text(10)
  .refine((v) => v === "" || isPastDate(v), { error: "dateInvalid" })
  .default("");
/** Dollar amount, stored as "1234.56" ("$1,234.56" is accepted). */
const money = text(20)
  .transform((v) => v.replace(/[$,\s]/g, ""))
  .refine((v) => v === "" || /^-?\d{1,10}(\.\d{1,2})?$/.test(v), { error: "amountInvalid" })
  .default("");
const count = (max: number) =>
  text(7)
    .refine((v) => v === "" || (/^\d+$/.test(v) && Number(v) <= max), { error: "invalid" })
    .default("");
const percent = text(6)
  .transform((v) => v.replace(/[%\s]/g, ""))
  .refine((v) => v === "" || (/^\d{1,3}(\.\d{1,2})?$/.test(v) && Number(v) <= 100), { error: "percentInvalid" })
  .default("");
const year = text(4)
  .refine((v) => v === "" || (/^\d{4}$/.test(v) && Number(v) >= 1900 && Number(v) <= new Date().getFullYear()), { error: "invalid" })
  .default("");
const ein = text(10)
  .refine((v) => v === "" || /^\d{2}-?\d{7}$/.test(v), { error: "einInvalid" })
  .default("");
/** A yes/no that may be left blank. */
const ynOpt = z.enum(["yes", "no", ""], { error: "choose" }).default("");
/** A yes/no added with the paper sheet: required on new forms, blank on older ones. */
const ynReq = z.enum(["yes", "no", ""], { error: "choose" }).refine((v) => v !== "", { error: "choose" });
/** A required choice that stays blank on older forms. */
const choice = <const T extends readonly string[]>(values: T) => z.enum([...values, ""], { error: "choose" }).refine((v) => v !== "", { error: "choose" });
const optChoice = <const T extends readonly string[]>(values: T) => z.enum([...values, ""], { error: "choose" }).default("");
const record = <K extends string, S extends z.ZodType>(keys: readonly K[], schema: S) =>
  z.object(Object.fromEntries(keys.map((k) => [k, schema])) as Record<K, S>).prefault({} as never);

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
  usCitizen: ynReq,
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

export const deceasedSpouseSchema = z
  .object({
    firstName: person.firstName,
    middleInitial: person.middleInitial,
    lastName: person.lastName,
    ssn: person.ssn,
    dob: person.dob,
    dateOfDeath: isoDate,
  })
  .refine((v) => v.dateOfDeath >= v.dob, { path: ["dateOfDeath"], error: "dateInvalid" });

export const dependentSchema = z.object({
  fullName: requiredText(120),
  ssn: taxId,
  dob: isoDate,
  relationship: z.enum(RELATIONSHIPS, { error: "choose" }),
  months: z.coerce.number({ error: "invalid" }).int({ error: "invalid" }).min(0, { error: "invalid" }).max(12, { error: "invalid" }),
  student: ynReq,
  disabled: ynReq,
  claimable: choice(CLAIMABLE),
});

export const childcareProviderSchema = z.object({ provider: requiredText(120), ein: optText(11), amount: money });

// ------------------------------------------------------------ Schedule C
const businessFields = {
  owner: choice(OWNERS_C),
  activity: requiredText(160),
  name: optText(100),
  ein,
  started: optDate,
  sameAddress: ynOpt,
  address: optText(160),
  method: optChoice(ACCOUNTING_METHODS),
  methodOther: optText(80),
  ...(Object.fromEntries(C_FLAGS.map(([k]) => [k, ynOpt])) as Record<(typeof C_FLAGS)[number][0], typeof ynOpt>),
  // Part I · income
  count1099: count(999),
  total1099: money,
  gross1099K: money,
  k1099Includes: optText(200),
  cashNotOn1099: money,
  records: z.array(z.enum(INCOME_RECORDS)).max(INCOME_RECORDS.length).default([]),
  returns: money,
  otherIncome: money,
  grossReceipts: money,
  agreesDeposits: ynOpt,
  // Part II · expenses
  expenses: record(
    C_EXPENSES.map(([k]) => k),
    money,
  ),
  phonePct: percent,
  internetPct: percent,
  otherList: optText(500),
  homeOfficeDetail: z
    .object({
      method: optChoice(HOME_OFFICE_METHODS),
      totalSqft: count(99999),
      businessSqft: count(99999),
      months: count(12),
      homeExpenses: optText(500),
    })
    .prefault({}),
  vehicleDetail: z
    .object({
      makeModel: optText(80),
      placedInService: optDate,
      totalMiles: count(999999),
      businessMiles: count(999999),
      commutingMiles: count(999999),
      otherMiles: count(999999),
      log: optChoice(MILEAGE_LOGS),
      writtenEvidence: ynOpt,
      personalOffDuty: ynOpt,
      otherVehicle: ynOpt,
      method: optChoice(VEHICLE_METHODS),
      ...(Object.fromEntries(VEHICLE_COSTS.map(([k]) => [k, money])) as Record<(typeof VEHICLE_COSTS)[number][0], typeof money>),
      purchase: optText(80),
      parkingTolls: money,
    })
    .prefault({}),
  cogs: record(
    COGS_LINES.map(([k]) => k),
    money,
  ),
  assets: z
    .array(z.object({ description: requiredText(120), date: optDate, cost: money, pct: percent, status: optChoice(ASSET_STATUSES) }))
    .max(MAX_ASSETS)
    .default([]),
  dueDiligence: record(
    C_DUE_DILIGENCE.map(([k]) => k),
    optText(500),
  ),
};
const businessObject = z.object(businessFields);
type Business = z.output<typeof businessObject>;
/** Sections opened by a "no" are emptied, so they never reach the PDF. */
export const businessSchema = businessObject.transform(
  (b): Business => ({
    ...b,
    address: b.sameAddress === "yes" ? "" : b.address,
    methodOther: b.method === "other" ? b.methodOther : "",
    homeOfficeDetail: b.homeOffice === "yes" ? b.homeOfficeDetail : businessObject.shape.homeOfficeDetail.parse(undefined),
    vehicleDetail: b.vehicle === "yes" ? b.vehicleDetail : businessObject.shape.vehicleDetail.parse(undefined),
    cogs: b.inventory === "yes" ? b.cogs : businessObject.shape.cogs.parse(undefined),
    assets: b.equipment === "yes" ? b.assets : [],
  }),
);
export type IntakeBusiness = z.output<typeof businessSchema>;
export const scheduleCSharedSchema = record(
  C_SHARED.map(([k]) => k),
  money,
);

// ------------------------------------------------------------ Schedule E
export const propertySchema = z.object({
  address: requiredText(160),
  type: optChoice(PROPERTY_TYPES),
  describe: optText(120),
  bought: optDate,
  firstRented: optDate,
  price: money,
  land: money,
  rentalDays: count(366),
  personalDays: count(366),
  monthsRented: count(12),
  monthsVacant: count(12),
  rentPerMonth: money,
  lender: optText(80),
  ...(Object.fromEntries(E_PROPERTY_FLAGS.map(([k]) => [k, ynOpt])) as Record<(typeof E_PROPERTY_FLAGS)[number][0], typeof ynOpt>),
  ...(Object.fromEntries(E_INCOME.map(([k]) => [k, money])) as Record<(typeof E_INCOME)[number][0], typeof money>),
  form1099: ynOpt,
  expenses: record(
    E_EXPENSES.map(([k]) => k),
    money,
  ),
  vehiclePct: percent,
  depreciationSchedule: ynOpt,
});
export type IntakeProperty = z.output<typeof propertySchema>;

const scheduleEObject = z.object({
  owner: choice(OWNERS_E),
  ownershipPct: percent,
  ...(Object.fromEntries(E_FLAGS.map(([k]) => [k, ynOpt])) as Record<(typeof E_FLAGS)[number][0], typeof ynOpt>),
  properties: z.array(propertySchema).max(MAX_PROPERTIES).default([]),
  improvementsMade: ynOpt,
  improvements: z
    .array(z.object({ property: optChoice(PROPERTY_LETTERS), description: requiredText(160), date: optDate, cost: money, type: optText(60) }))
    .max(MAX_IMPROVEMENTS)
    .default([]),
  k1s: z
    .array(z.object({ entity: requiredText(120), ein, type: optText(40), received: ynOpt, materially: ynOpt, basis: money }))
    .max(MAX_K1S)
    .default([]),
  priorLosses: ynOpt,
  dueDiligence: record(
    E_DUE_DILIGENCE.map(([k]) => k),
    optText(500),
  ),
});
export const scheduleESchema = scheduleEObject.transform((e) => ({ ...e, improvements: e.improvementsMade === "yes" ? e.improvements : [] }));
export type IntakeScheduleE = z.output<typeof scheduleESchema>;

const incomeDetailsSchema = z
  .object({ w2Employers: count(99), tipsOvertime: ynOpt, keepsRecords: ynOpt, necIsBusiness: ynOpt, kIsBusiness: ynOpt })
  .prefault({});
const dueDiligenceSchema = z
  .object({ homeCost: optText(500), childResidence: optText(500), creditDisallowed: ynOpt, disallowedYear: year })
  .prefault({});

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
    /** Marital status on December 31 (paper sheet, section A). */
    maritalStatus: choice(MARITAL_STATUSES),
    spouseDeathYear: year,
    /** Older forms asked this when the filing status was "not sure"; now it follows the marital status. */
    married: z.enum(["yes", "no", ""]).default(""),
    spouse: spouseSchema.nullable(),
    /** Only for a qualifying surviving spouse; older submissions have none. */
    deceasedSpouse: deceasedSpouseSchema.nullable().default(null),
    county: optText(80),
    multiState: ynReq,
    statesDetail: optText(500),
    housing: choice(HOUSING),
    hasDependents: yesNo,
    dependents: z.array(dependentSchema).max(MAX_DEPENDENTS),
    income: z.array(z.enum([...INCOME_TYPES, ...LEGACY_INCOME])).max(INCOME_TYPES.length + LEGACY_INCOME.length),
    incomeDetails: incomeDetailsSchema,
    businessDescription: text(300),
    otherIncome: text(300),
    deductions: z.array(z.enum([...DEDUCTION_TYPES, ...LEGACY_DEDUCTIONS])).max(DEDUCTION_TYPES.length + LEGACY_DEDUCTIONS.length),
    /** Older forms only: the provider as free text. */
    childcareProvider: optText(300),
    childcare: z.array(childcareProviderSchema).max(MAX_CHILDCARE_PROVIDERS).default([]),
    estimatedDetails: optText(500),
    questions: z.object(Object.fromEntries(QUESTIONS.map((q) => [q, yesNo])) as Record<Question, typeof yesNo>),
    questionDetails: z.object(Object.fromEntries(QUESTIONS.map((q) => [q, text(500)])) as Record<Question, ReturnType<typeof text>>),
    dueDiligence: dueDiligenceSchema,
    refund: refundSchema,
    priorReturn: ynReq,
    otherStateLastYear: ynReq,
    authorizedPerson: optText(160),
    referral: z.enum([...REFERRALS, ""]).default(""),
    referralOther: text(120),
    notes: text(2000),
    /** Schedule C sheets, one per business. */
    businesses: z.array(businessSchema).max(MAX_BUSINESSES).default([]),
    scheduleCShared: scheduleCSharedSchema,
    /** Schedule E sheet (rentals, royalties, K-1s). */
    scheduleE: scheduleESchema.nullable().default(null),
  })
  .superRefine((value, ctx) => {
    const issue = (path: (string | number)[], message: IntakeErrorKey) => ctx.addIssue({ code: "custom", path, message });
    const married = value.filingStatus === "unsure" ? marriedFrom(value.maritalStatus) : value.married;
    if (needsSpouse(value.filingStatus, married) && !value.spouse) issue(["spouse"], "required");
    if (needsDeceasedSpouse(value.filingStatus) && !value.deceasedSpouse) issue(["deceasedSpouse"], "required");
    if (value.multiState === "yes" && !value.statesDetail) issue(["statesDetail"], "required");
    if (value.hasDependents === "yes" && value.dependents.length === 0) issue(["dependents"], "dependentsRequired");
    if (value.income.includes("other") && !value.otherIncome) issue(["otherIncome"], "required");
    if (value.income.includes("necMisc") && !value.incomeDetails.necIsBusiness) issue(["incomeDetails", "necIsBusiness"], "choose");
    if (value.income.includes("paymentApps") && !value.incomeDetails.kIsBusiness) issue(["incomeDetails", "kIsBusiness"], "choose");
    if (value.dueDiligence.creditDisallowed === "yes" && !value.dueDiligence.disallowedYear) issue(["dueDiligence", "disallowedYear"], "required");
    if (needsScheduleC(value) && value.businesses.length === 0) issue(["businesses"], "rowRequired");
    if (needsScheduleE(value)) {
      if (!value.scheduleE) issue(["scheduleE"], "required");
      else {
        if (needsProperties(value) && value.scheduleE.properties.length === 0) issue(["scheduleE", "properties"], "rowRequired");
        if (value.income.includes("k1") && value.scheduleE.k1s.length === 0) issue(["scheduleE", "k1s"], "rowRequired");
      }
    }
  })
  // Answers to questions that no longer apply are dropped, so they never reach the PDF.
  .transform((value) => {
    const married = value.filingStatus === "unsure" ? marriedFrom(value.maritalStatus) : "";
    const has = (k: string) => value.income.includes(k as never);
    const scheduleC = needsScheduleC(value);
    return {
      ...value,
      married,
      spouseDeathYear: value.maritalStatus === "widowed" ? value.spouseDeathYear : "",
      spouse: needsSpouse(value.filingStatus, married) ? value.spouse : null,
      deceasedSpouse: needsDeceasedSpouse(value.filingStatus) ? value.deceasedSpouse : null,
      statesDetail: value.multiState === "yes" ? value.statesDetail : "",
      dependents: value.hasDependents === "yes" ? value.dependents : [],
      incomeDetails: {
        w2Employers: has("w2") ? value.incomeDetails.w2Employers : "",
        tipsOvertime: has("w2") ? value.incomeDetails.tipsOvertime : "",
        keepsRecords: has("selfEmployment") ? value.incomeDetails.keepsRecords : "",
        necIsBusiness: has("necMisc") ? value.incomeDetails.necIsBusiness : "",
        kIsBusiness: has("paymentApps") ? value.incomeDetails.kIsBusiness : "",
      } as typeof value.incomeDetails,
      businessDescription: has("selfEmployment") ? value.businessDescription : "",
      otherIncome: has("other") ? value.otherIncome : "",
      childcareProvider: value.deductions.includes("childcare") ? value.childcareProvider : "",
      childcare: value.deductions.includes("childcare") ? value.childcare : [],
      estimatedDetails: value.deductions.includes("estimatedPayments") ? value.estimatedDetails : "",
      questionDetails: Object.fromEntries(
        QUESTIONS.map((q) => [q, value.questions[q] === QUESTION_FOLLOW_UP[q] ? value.questionDetails[q] : ""]),
      ) as Record<Question, string>,
      dueDiligence: { ...value.dueDiligence, disallowedYear: value.dueDiligence.creditDisallowed === "yes" ? value.dueDiligence.disallowedYear : "" },
      referralOther: value.referral === "other" ? value.referralOther : "",
      businesses: scheduleC ? value.businesses : [],
      scheduleCShared: scheduleC ? value.scheduleCShared : scheduleCSharedSchema.parse(undefined),
      scheduleE: needsScheduleE(value) && value.scheduleE ? { ...value.scheduleE, k1s: has("k1") ? value.scheduleE.k1s : [] } : null,
    };
  });

export type IntakeData = z.output<typeof intakeDataSchema>;

/**
 * Stored answers of older forms lack the questions added with the paper
 * sheet: they read as blank, so every view and the PDF can rely on them.
 */
export function normalizeIntakeData(data: IntakeData): IntakeData {
  const d = data as Partial<IntakeData> & Pick<IntakeData, "taxpayer" | "dependents">;
  return {
    married: "",
    deceasedSpouse: null,
    maritalStatus: "",
    spouseDeathYear: "",
    county: "",
    multiState: "",
    statesDetail: "",
    housing: "",
    childcareProvider: "",
    childcare: [],
    estimatedDetails: "",
    priorReturn: "",
    otherStateLastYear: "",
    authorizedPerson: "",
    businesses: [],
    scheduleE: null,
    ...d,
    incomeDetails: { ...incomeDetailsSchema.parse(undefined), ...d.incomeDetails },
    dueDiligence: { ...dueDiligenceSchema.parse(undefined), ...d.dueDiligence },
    scheduleCShared: { ...scheduleCSharedSchema.parse(undefined), ...d.scheduleCShared },
    taxpayer: { ...d.taxpayer, usCitizen: d.taxpayer.usCitizen ?? "" },
    spouse: d.spouse ? { ...d.spouse, usCitizen: d.spouse.usCitizen ?? "" } : null,
    dependents: (d.dependents ?? []).map((dep) => ({ ...dep, student: dep.student ?? "", disabled: dep.disabled ?? "", claimable: dep.claimable ?? "" })),
  } as IntakeData;
}

const signatureImage = z.string().max(MAX_SIGNATURE_BYTES * 2);
const facePhoto = z.string().max(MAX_FACE_PHOTO_BYTES * 2);

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
    /** JPEG of the taxpayer's face, checked in the browser to show one face. */
    facePhoto: facePhoto.startsWith(FACE_PHOTO_PREFIX, { error: "facePhotoRequired" }),
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
  facePhoto: facePhoto.default(""),
  uploadIds: z.array(z.uuid()).max(MAX_INTAKE_UPLOADS),
  /** Public form only: reCAPTCHA v3 token and honeypot (must stay empty). */
  recaptchaToken: z.string().max(4000).default(""),
  website: z.string().max(500).default(""),
});

export const intakeUploadIntentSchema = z.object({
  name: z.string().min(1).max(255),
  size: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  mime: z.string().max(200),
  docType: z.enum(DOC_TYPES),
  /** Public form only. */
  recaptchaToken: z.string().max(4000).default(""),
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
  "facePhotoRequired",
  "dependentsRequired",
  "amountInvalid",
  "percentInvalid",
  "einInvalid",
  "rowRequired",
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
