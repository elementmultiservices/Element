import type { PdfInput, PdfLabels } from "./pdf";

type Translate = (key: string, values?: Record<string, string | number>) => string;

/** Clauses of the service agreement, in order (Intake.agreement.clauses.<key>). */
export const AGREEMENT_CLAUSES = ["services", "responsibilities", "excluded", "fees", "letters", "privacy", "esign", "term"] as const;

/** Package texts in one language (`t` reads the Intake messages). */
export function intakePdfContent(
  t: Translate,
  values: { year: number; name: string; reference: string; submitted: string; pub135: boolean; agreement: boolean },
): { labels: PdfLabels; agreement: PdfInput["agreement"] } {
  return {
    labels: {
      title: t("pdf.title"),
      subtitle: t("pdf.subtitle", { year: values.year, name: values.name }),
      packageParts: t("pdf.packageParts"),
      reference: t("pdf.reference", { reference: values.reference }),
      submitted: t("pdf.submitted", { date: values.submitted }),
      part1: t("pdf.part1"),
      part2: t("pdf.part2"),
      part3: t("pdf.part3"),
      documentsEmpty: t("pdf.documentsEmpty"),
      documentsSeparate: t("pdf.documentsSeparate"),
      declarationTitle: t("sign.declarationTitle"),
      declaration: t("sign.declaration"),
      confirmationsTitle: t("sign.confirmationsTitle"),
      signedBy: t("pdf.signedBy"),
      spouseSignedBy: t("pdf.spouseSignedBy"),
      signedAt: t("pdf.signedAt"),
      signerIp: t("pdf.signerIp"),
      facePhoto: t("face.title"),
      attachmentHeading: t("pdf.attachment"),
      attachmentFailed: t("pdf.attachmentFailed"),
      page: t("pdf.page"),
    },
    agreement: {
      intro: t("agreement.intro"),
      clauses: AGREEMENT_CLAUSES.map((k) => ({ title: t(`agreement.clauses.${k}.title`), body: t(`agreement.clauses.${k}.body`) })),
      confirmations: [
        { label: t("sign.pub135"), checked: values.pub135 },
        { label: t("sign.agreement"), checked: values.agreement },
      ],
    },
  };
}
