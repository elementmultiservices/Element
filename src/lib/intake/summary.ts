import type { IntakeData } from "./schema";
import { maskTaxId, QUESTION_FOLLOW_UP } from "./schema";

/**
 * Turns stored answers into labelled sections, used by the PDF and by the
 * on-screen detail views. `t` reads the Intake messages of the wanted
 * language. Tax IDs, IP PINs and bank numbers are masked unless `full` is set.
 * Follow-up answers only appear when the question that opens them applies.
 */
export type SummaryRow = { label: string; value: string };
export type SummarySection = { title: string; rows: SummaryRow[] };
type Translate = (key: string, values?: Record<string, string | number>) => string;

export function intakeSummary(data: IntakeData, t: Translate, options: { full: boolean }): SummarySection[] {
  const id = (v: string) => (options.full ? v : maskTaxId(v));
  const pin = (v: string) => (!v ? blank : options.full ? v : "******");
  const blank = t("summary.none");
  const show = (v: string | undefined | null) => (v && v.trim() ? v : blank);
  const yesNo = (v: string) => (v === "yes" ? t("summary.yes") : t("summary.no"));

  type Person = NonNullable<IntakeData["spouse"]> & { workPhone?: string };
  const personRows = (p: Person, spouse: boolean): SummaryRow[] => [
    { label: t("fields.firstName"), value: p.firstName },
    { label: t("fields.middleInitial"), value: show(p.middleInitial) },
    { label: t("fields.lastName"), value: p.lastName },
    { label: t("fields.ssn"), value: id(p.ssn) },
    { label: t("fields.dob"), value: p.dob },
    { label: t("fields.ipPin"), value: pin(p.ipPin) },
    { label: t("fields.occupation"), value: show(p.occupation) },
    { label: t("fields.cellPhone"), value: show(p.cellPhone) },
    ...(p.workPhone !== undefined ? [{ label: t("fields.workPhone"), value: show(p.workPhone) }] : []),
    { label: t("fields.email"), value: show(p.email) },
    { label: t(spouse ? "fields.spouseBlind" : "fields.blind"), value: yesNo(p.blind) },
    { label: t(spouse ? "fields.spouseClaimedByOther" : "fields.claimedByOther"), value: yesNo(p.claimedByOther) },
  ];

  const tp = data.taxpayer;
  const sections: SummarySection[] = [
    {
      title: t("sections.general.summary"),
      rows: [
        { label: t("fields.taxYear"), value: String(data.taxYear) },
        { label: t("fields.preferredLanguage"), value: t(`languages.${data.preferredLanguage}`) },
      ],
    },
    {
      title: t("sections.taxpayer.title"),
      rows: [
        ...personRows(tp, false),
        { label: t("summary.address"), value: `${tp.street}${tp.apt ? `, ${tp.apt}` : ""}, ${tp.city}, ${tp.state} ${tp.zip}` },
      ],
    },
    {
      title: t("sections.filingStatus.title"),
      rows: [
        { label: t("fields.filingStatus"), value: t(`filingStatus.${data.filingStatus}`) },
        ...(data.filingStatus === "unsure" ? [{ label: t("fields.married"), value: yesNo(data.married) }] : []),
      ],
    },
  ];

  if (data.spouse) sections.push({ title: t("sections.spouse.title"), rows: personRows(data.spouse, true) });

  sections.push({
    title: t("sections.dependents.title"),
    rows: [
      { label: t("fields.hasDependents"), value: yesNo(data.hasDependents) },
      ...data.dependents.map((d, i) => ({
        label: t("summary.dependent", { n: i + 1 }),
        value: [
          d.fullName,
          `${t("fields.ssn")}: ${id(d.ssn)}`,
          `${t("fields.dob")}: ${d.dob}`,
          `${t("fields.relationship")}: ${t(`relationships.${d.relationship}`)}`,
          `${t("fields.months")}: ${d.months}`,
        ].join(" · "),
      })),
    ],
  });

  sections.push({
    title: t("sections.income.title"),
    rows: [
      { label: t("summary.selected"), value: data.income.length ? data.income.map((k) => t(`income.${k}`)).join(", ") : blank },
      ...(data.businessDescription ? [{ label: t("fields.businessDescription"), value: data.businessDescription }] : []),
      ...(data.otherIncome ? [{ label: t("fields.otherIncome"), value: data.otherIncome }] : []),
    ],
  });

  sections.push({
    title: t("sections.deductions.title"),
    rows: [
      { label: t("summary.selected"), value: data.deductions.length ? data.deductions.map((k) => t(`deductions.${k}`)).join(", ") : blank },
      ...(data.childcareProvider ? [{ label: t("fields.childcareProvider"), value: data.childcareProvider }] : []),
    ],
  });

  sections.push({
    title: t("sections.questions.title"),
    rows: (Object.keys(QUESTION_FOLLOW_UP) as (keyof typeof QUESTION_FOLLOW_UP)[]).flatMap((q) => [
      { label: t(`questions.${q}`), value: yesNo(data.questions[q]) },
      ...(data.questionDetails[q] ? [{ label: t(`followUps.${q}`), value: data.questionDetails[q] }] : []),
    ]),
  });

  const r = data.refund;
  sections.push({
    title: t("sections.refund.title"),
    rows:
      r.method !== "direct"
        ? [{ label: t("fields.refundMethod"), value: t(`refund.${r.method}`) }]
        : [
            { label: t("fields.refundMethod"), value: t("refund.direct") },
            { label: t("fields.bankName"), value: r.bankName },
            { label: t("fields.routing"), value: options.full ? r.routing : `*****${r.routing.slice(-4)}` },
            { label: t("fields.account"), value: options.full ? r.account : `****${r.account.slice(-4)}` },
            { label: t("fields.accountType"), value: t(`refund.${r.accountType}`) },
          ],
  });

  sections.push({
    title: t("sections.referral.title"),
    rows: [
      { label: t("fields.referral"), value: data.referral ? t(`referrals.${data.referral}`) : blank },
      ...(data.referralOther ? [{ label: t("fields.referralOther"), value: data.referralOther }] : []),
    ],
  });

  if (data.notes) sections.push({ title: t("sections.notes.title"), rows: [{ label: t("fields.notes"), value: data.notes }] });
  return sections;
}
