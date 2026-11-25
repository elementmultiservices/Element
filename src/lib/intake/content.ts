import type { PdfInput, PdfLabels } from "./pdf";

type Translate = (key: string, values?: Record<string, string | number>) => string;

/** Clauses of the service agreement, in order (Intake.agreement.clauses.<key>). */
export const AGREEMENT_CLAUSES = ["services", "responsibilities", "excluded", "fees", "letters", "privacy", "esign", "term"] as const;

/**
 * Texts of the parts that follow the bilingual sheets (service agreement and
 * documents), in one language (`t` reads the Intake messages).
 */
export function intakePdfContent(t: Translate, values: { pub135: boolean; agreement: boolean }): { labels: PdfLabels; agreement: PdfInput["agreement"] } {
  return {
    labels: {
      agreementTitle: t("pdf.part2"),
      confirmationsTitle: t("sign.confirmationsTitle"),
      documentsTitle: t("pdf.part3"),
      documentsEmpty: t("pdf.documentsEmpty"),
      documentsSeparate: t("pdf.documentsSeparate"),
      signedBy: t("pdf.signedBy"),
      spouseSignedBy: t("pdf.spouseSignedBy"),
      signedAt: t("pdf.signedAt"),
      signerIp: t("pdf.signerIp"),
      attachmentHeading: t("pdf.attachment"),
      attachmentFailed: t("pdf.attachmentFailed"),
    },
    agreement: {
      intro: t("agreement.intro"),
      clauses: AGREEMENT_CLAUSES.map((k) => ({ title: t(`agreement.clauses.${k}.title`), body: t(`agreement.clauses.${k}.body`) })),
      confirmations: [
        { label: t("sign.consent"), checked: true },
        { label: t("sign.pub135"), checked: values.pub135 },
        { label: t("sign.agreement"), checked: values.agreement },
      ],
    },
  };
}
