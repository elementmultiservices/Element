import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { intakePdfContent } from "@/lib/intake/content";
import { buildIntakePdf } from "@/lib/intake/pdf";
import {
  intakeDataSchema,
  intakeErrorsFrom,
  intakeSigningSchema,
  isRoutingNumber,
  needsScheduleC,
  needsScheduleE,
  needsSpouse,
  normalizeIntakeData,
  recommendedDocs,
  type IntakeData,
} from "@/lib/intake/schema";
import { intakeSummary } from "@/lib/intake/summary";

const person = {
  middleInitial: "",
  ipPin: "",
  occupation: "",
  blind: "no",
  claimedByOther: "no",
  usCitizen: "yes",
};

const valid = {
  taxYear: "2025",
  preferredLanguage: "es",
  taxpayer: {
    ...person,
    firstName: "Ana",
    middleInitial: "M",
    lastName: "Núñez",
    ssn: "123-45-6789",
    dob: "1985-04-12",
    occupation: "Nurse",
    cellPhone: "(917) 555-0100",
    workPhone: "",
    email: "ana@example.com",
    street: "2330 Cambreleng Ave",
    apt: "3B",
    city: "Bronx",
    state: "ny",
    zip: "10458",
  },
  county: "",
  multiState: "no",
  statesDetail: "ignored",
  housing: "rent",
  filingStatus: "mfj",
  maritalStatus: "married",
  married: "",
  spouse: { ...person, firstName: "Luis", lastName: "Pérez", ssn: "987654321", dob: "1983-01-02", cellPhone: "", email: "" },
  hasDependents: "yes",
  dependents: [{ fullName: "Sofía Pérez", ssn: "111-22-3333", dob: "2015-09-30", relationship: "daughter", months: "12", student: "no", disabled: "no", claimable: "no" }],
  income: ["w2", "selfEmployment"],
  businessDescription: "Cleaning",
  otherIncome: "",
  deductions: ["childcare"],
  childcareProvider: "ABC Kids, EIN 12-3456789",
  questions: { irsLetter: "yes", movedState: "no", homeSale: "no", fullYearCoverage: "yes", foreignAccounts: "no" },
  questionDetails: { irsLetter: "CP2000 notice", movedState: "ignored", homeSale: "", fullYearCoverage: "", foreignAccounts: "" },
  priorReturn: "yes",
  otherStateLastYear: "no",
  businesses: [{ owner: "spouse", activity: "House cleaning", expenses: { supplies: "$1,200.50" }, vehicle: "no", vehicleDetail: { makeModel: "dropped" } }],
  refund: { method: "direct", bankName: "Chase", routing: "021000021", account: "123456789", accountType: "checking" },
  referral: "google",
  referralOther: "ignored",
  notes: "",
};

type Tree = { [key: string]: string | Tree };
/** Minimal stand-in for next-intl: resolves keys of the Intake catalogue and fills {placeholders}. */
function translator(messages: Tree) {
  return (key: string, values?: Record<string, string | number>) => {
    const found = key.split(".").reduce<string | Tree | undefined>((node, k) => (node && typeof node === "object" ? node[k] : undefined), messages);
    if (typeof found !== "string") throw new Error(`missing message: ${key}`);
    return found.replace(/\{(\w+)\}/g, (_, name: string) => String(values?.[name] ?? ""));
  };
}

describe("intake schema", () => {
  it("accepts a complete package and normalizes it", () => {
    const parsed = intakeDataSchema.parse(valid);
    expect(parsed.taxYear).toBe(2025);
    expect(parsed.taxpayer.state).toBe("NY");
    expect(parsed.spouse?.ssn).toBe("987-65-4321");
    expect(parsed.dependents[0]?.months).toBe(12);
  });

  it("drops answers to follow-ups that no longer apply", () => {
    const parsed = intakeDataSchema.parse({ ...valid, filingStatus: "single", hasDependents: "no", income: ["w2"], deductions: [], referral: "google" });
    expect(parsed.spouse).toBeNull();
    expect(parsed.dependents).toEqual([]);
    expect(parsed.businessDescription).toBe("");
    expect(parsed.childcareProvider).toBe("");
    expect(parsed.questionDetails.irsLetter).toBe("CP2000 notice");
    expect(parsed.questionDetails.movedState).toBe("");
    expect(parsed.referralOther).toBe("");
  });

  it("follows the marital status when the filing status is not known", () => {
    expect(needsSpouse("unsure", "yes")).toBe(true);
    expect(needsSpouse("unsure", "no")).toBe(false);
    const missing = intakeDataSchema.safeParse({ ...valid, filingStatus: "unsure", maritalStatus: "" });
    expect(missing.success).toBe(false);
    if (!missing.success) expect(intakeErrorsFrom(missing.error).maritalStatus).toBe("choose");
    expect(intakeDataSchema.parse({ ...valid, filingStatus: "unsure", maritalStatus: "single" }).spouse).toBeNull();
    const married = intakeDataSchema.parse({ ...valid, filingStatus: "unsure", maritalStatus: "married" });
    expect(married.married).toBe("yes");
    expect(married.spouse).not.toBeNull();
  });

  it("opens Schedule C for self-employment and Schedule E for rentals, royalties or K-1s", () => {
    expect(needsScheduleC({ income: ["w2"] })).toBe(false);
    expect(needsScheduleC({ income: ["necMisc"], incomeDetails: { necIsBusiness: "yes" } })).toBe(true);
    expect(needsScheduleC({ income: ["paymentApps"], incomeDetails: { kIsBusiness: "no" } })).toBe(false);
    expect(needsScheduleE({ income: ["royalties"] })).toBe(true);

    const parsed = intakeDataSchema.parse(valid);
    expect(parsed.businesses).toHaveLength(1);
    expect(parsed.businesses[0]?.expenses.supplies).toBe("1200.50");
    expect(parsed.businesses[0]?.vehicleDetail.makeModel).toBe("");
    expect(parsed.scheduleE).toBeNull();

    // Without self-employment the business sheet is dropped.
    expect(intakeDataSchema.parse({ ...valid, income: ["w2"] }).businesses).toEqual([]);
    const noBusiness = intakeDataSchema.safeParse({ ...valid, businesses: [] });
    expect(noBusiness.success).toBe(false);
    if (!noBusiness.success) expect(intakeErrorsFrom(noBusiness.error).businesses).toBe("rowRequired");

    const rental = intakeDataSchema.safeParse({ ...valid, income: ["rental", "k1"], scheduleE: { owner: "both", properties: [], k1s: [] } });
    expect(rental.success).toBe(false);
    if (!rental.success) expect(intakeErrorsFrom(rental.error)).toMatchObject({ "scheduleE.properties": "rowRequired", "scheduleE.k1s": "rowRequired" });

    const withRental = intakeDataSchema.parse({
      ...valid,
      income: ["rental"],
      scheduleE: { owner: "both", properties: [{ address: "12 Main St, Bronx, NY", type: "1", rents: "18000", expenses: { taxes: "4200" } }] },
    });
    expect(withRental.scheduleE?.properties[0]?.rents).toBe("18000");
    expect(withRental.scheduleE?.properties[0]?.expenses.taxes).toBe("4200");
    const badAmount = intakeDataSchema.safeParse({ ...valid, income: ["rental"], scheduleE: { owner: "both", properties: [{ address: "1 A St", expenses: { repairs: "abc" } }] } });
    expect(badAmount.success).toBe(false);
    if (!badAmount.success) expect(intakeErrorsFrom(badAmount.error)["scheduleE.properties.0.expenses.repairs"]).toBe("amountInvalid");
  });

  it("reads older stored answers with the new questions blank", () => {
    const { maritalStatus: _m, priorReturn: _p, otherStateLastYear: _o, businesses: _b, ...old } = intakeDataSchema.parse(valid);
    const normalized = normalizeIntakeData(old as IntakeData);
    expect(normalized.maritalStatus).toBe("");
    expect(normalized.businesses).toEqual([]);
    expect(normalized.scheduleE).toBeNull();
    expect(normalized.incomeDetails.w2Employers).toBe("");
  });

  it("requires the spouse when married, a dependent when answered yes, and a description for other income", () => {
    const result = intakeDataSchema.safeParse({ ...valid, filingStatus: "mfs", spouse: null, dependents: [], income: ["other"], otherIncome: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(intakeErrorsFrom(result.error)).toMatchObject({ spouse: "required", dependents: "dependentsRequired", otherIncome: "required" });
    }
  });

  it("reports field errors by path", () => {
    const result = intakeDataSchema.safeParse({
      ...valid,
      taxpayer: { ...valid.taxpayer, ssn: "000-12-3456", zip: "1045", blind: "" },
      dependents: [{ ...valid.dependents[0], dob: "2999-01-01" }],
      refund: { ...valid.refund, routing: "123456789" },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = intakeErrorsFrom(result.error);
      expect(errors["taxpayer.ssn"]).toBe("ssnInvalid");
      expect(errors["taxpayer.zip"]).toBe("zipInvalid");
      expect(errors["taxpayer.blind"]).toBe("choose");
      expect(errors["dependents.0.dob"]).toBe("dateInvalid");
      expect(errors["refund.routing"]).toBe("routingInvalid");
    }
  });

  it("only needs bank details for direct deposit", () => {
    expect(intakeDataSchema.safeParse({ ...valid, refund: { method: "check" } }).success).toBe(true);
    expect(intakeDataSchema.safeParse({ ...valid, refund: { method: "applyNext" } }).success).toBe(true);
    const missing = intakeDataSchema.safeParse({ ...valid, refund: { method: "" } });
    expect(missing.success).toBe(false);
    if (!missing.success) expect(Object.keys(intakeErrorsFrom(missing.error)).some((k) => k.startsWith("refund"))).toBe(true);
  });

  it("validates ABA routing numbers", () => {
    expect(isRoutingNumber("021000021")).toBe(true);
    expect(isRoutingNumber("021000022")).toBe(false);
    expect(isRoutingNumber("12345")).toBe(false);
  });

  it("requires every confirmation, and the spouse's signature only for joint returns", () => {
    const base = {
      consent: true,
      pub135: true,
      agreement: true,
      signature: "data:image/png;base64,AAAA",
      signatureMethod: "type",
      spouseSignature: "",
      spouseSignatureMethod: "",
      facePhoto: "data:image/jpeg;base64,AAAA",
    };
    expect(intakeSigningSchema.safeParse({ ...base, filingStatus: "single" }).success).toBe(true);
    for (const facePhoto of ["", "data:image/png;base64,AAAA"]) {
      const noPhoto = intakeSigningSchema.safeParse({ ...base, facePhoto, filingStatus: "single" });
      expect(noPhoto.success).toBe(false);
      if (!noPhoto.success) expect(intakeErrorsFrom(noPhoto.error)).toMatchObject({ facePhoto: "facePhotoRequired" });
    }
    const joint = intakeSigningSchema.safeParse({ ...base, filingStatus: "mfj" });
    expect(joint.success).toBe(false);
    if (!joint.success) expect(intakeErrorsFrom(joint.error)).toMatchObject({ spouseSignature: "signatureRequired" });
    expect(intakeSigningSchema.safeParse({ ...base, filingStatus: "mfj", spouseSignature: base.signature, spouseSignatureMethod: "upload" }).success).toBe(true);
    const unchecked = intakeSigningSchema.safeParse({ ...base, pub135: false, agreement: false, filingStatus: "single" });
    expect(unchecked.success).toBe(false);
    if (!unchecked.success) expect(intakeErrorsFrom(unchecked.error)).toMatchObject({ pub135: "consentRequired", agreement: "consentRequired" });
  });

  it("recommends documents from the answers", () => {
    const docs = recommendedDocs({ hasDependents: "yes", income: ["w2"], deductions: [], questions: { irsLetter: "yes" } });
    expect([...docs].sort()).toEqual(["dependents", "id", "income", "irs_letters", "ssn"]);
  });
});

describe("intake summary and PDF", () => {
  const data: IntakeData = intakeDataSchema.parse(valid);

  it("masks tax IDs, IP PINs and bank numbers unless full", () => {
    const t = translator(en.Intake as unknown as Tree);
    const withPin: IntakeData = { ...data, taxpayer: { ...data.taxpayer, ipPin: "654321" } };
    const masked = JSON.stringify(intakeSummary(withPin, t, { full: false, locale: "es" }));
    expect(masked).toContain("Anexo C");
    expect(masked).not.toContain("123-45-6789");
    expect(masked).not.toContain("123456789");
    expect(masked).not.toContain("654321");
    expect(masked).toContain("***-**-6789");
    const full = JSON.stringify(intakeSummary(withPin, t, { full: true }));
    expect(full).toContain("123-45-6789");
    expect(full).toContain("021000021");
    expect(full).toContain("654321");
    expect(full).toContain("CP2000 notice");
  });

  it("builds the sheets, the agreement and the attachments; Schedule C and E only when they apply", async () => {
    const attached = await PDFDocument.create();
    attached.addPage();
    attached.addPage();
    const attachedBytes = await attached.save();
    // 1×1 transparent PNG
    const png = Uint8Array.from(
      Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64"),
    );

    for (const messages of [en, es]) {
      const t = translator(messages.Intake as unknown as Tree);
      const content = intakePdfContent(t, { pub135: true, agreement: true });
      const bytes = await buildIntakePdf({
        businessName: "Element",
        ...content,
        data: { ...data, notes: "Línea 1\nLínea 2 — emoji and symbols outside Latin-1: \u{1F600} \u4E2D" },
        full: true,
        clientName: "Ana M Núñez",
        reference: "ABCD1234",
        attachments: [
          { name: "w2.pdf", typeLabel: t("docTypes.income"), sizeLabel: "1 KB", mime: "application/pdf", bytes: attachedBytes },
          { name: "id.png", typeLabel: t("docTypes.id"), sizeLabel: "1 KB", mime: "image/png", bytes: png },
          { name: "broken.pdf", typeLabel: t("docTypes.other"), sizeLabel: "1 KB", mime: "application/pdf", bytes: new Uint8Array([1, 2, 3]) },
          { name: "budget.xlsx", typeLabel: t("docTypes.other"), sizeLabel: "1 KB", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", bytes: null },
        ],
        signature: { name: "Ana Núñez", png, method: t("signatureMethods.type") },
        spouseSignature: { name: "Luis Pérez", png, method: t("signatureMethods.upload") },
        // Not a JPEG: the photo is skipped instead of breaking the PDF.
        facePhoto: new Uint8Array([1, 2, 3]),
        signedAt: "Oct 22, 2026",
        signerIp: "203.0.113.7",
      });
      const doc = await PDFDocument.load(bytes);
      // Intake sheet, Schedule C, agreement, cover + 2 pages for the PDF, image page, failure note page.
      expect(doc.getPageCount()).toBeGreaterThanOrEqual(10);
    }

    // Page counts: W-2 only < with Schedule C < with Schedules C and E.
    const t = translator(en.Intake as unknown as Tree);
    const pages = async (d: IntakeData) => {
      const bytes = await buildIntakePdf({
        businessName: "Element",
        ...intakePdfContent(t, { pub135: true, agreement: true }),
        data: d,
        full: false,
        clientName: "Ana M Núñez",
        reference: "ABCD1234",
        attachments: [],
        signature: { name: "Ana Núñez", png, method: "typed" },
        spouseSignature: null,
        facePhoto: null,
        signedAt: "Oct 22, 2026",
        signerIp: null,
      });
      return (await PDFDocument.load(bytes)).getPageCount();
    };
    const w2Only = await pages(intakeDataSchema.parse({ ...valid, income: ["w2"] }));
    const withC = await pages(data);
    const withCE = await pages(
      intakeDataSchema.parse({
        ...valid,
        income: ["selfEmployment", "rental", "k1"],
        scheduleE: { owner: "both", properties: [{ address: "12 Main St" }], k1s: [{ entity: "ABC LLC", received: "yes" }] },
      }),
    );
    expect(withC).toBeGreaterThan(w2Only);
    expect(withCE).toBeGreaterThan(withC);
  });
});
