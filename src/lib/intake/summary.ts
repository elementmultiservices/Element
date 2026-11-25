import type { IntakeData } from "./schema";
import { maskTaxId, QUESTION_FOLLOW_UP } from "./schema";
import {
  ACCOUNTING_LABELS,
  ASSET_STATUS_LABELS,
  C_DUE_DILIGENCE,
  C_EXPENSES,
  C_FLAGS,
  C_SHARED,
  CLAIMABLE_LABELS,
  COGS_LINES,
  DEDUCTION_LABELS,
  E_DETAILS,
  E_DUE_DILIGENCE,
  E_EXPENSES,
  E_FLAGS,
  E_INCOME,
  E_PROPERTY_FLAGS,
  fill,
  formatAmount,
  HOME_OFFICE_METHOD_LABELS,
  HOUSING_LABELS,
  INCOME_LABELS,
  INCOME_RECORD_LABELS,
  MAIN,
  MARITAL_LABELS,
  MILEAGE_LOG_LABELS,
  OWNER_LABELS,
  pick,
  PROPERTY_LETTERS,
  PROPERTY_TYPE_LABELS,
  sumAmounts,
  VEHICLE_COSTS,
  VEHICLE_METHOD_LABELS,
  type Bi,
} from "./sheet";

/**
 * Turns stored answers into labelled sections, used by the on-screen detail
 * views. `t` reads the Intake messages of the wanted language and `locale`
 * picks the language of the sheet texts. Tax IDs, IP PINs and bank numbers
 * are masked unless `full` is set. Follow-up answers only appear when the
 * question that opens them applies; blank sheet answers are left out.
 */
export type SummaryRow = { label: string; value: string };
export type SummarySection = { title: string; rows: SummaryRow[] };
type Translate = (key: string, values?: Record<string, string | number>) => string;

export function intakeSummary(data: IntakeData, t: Translate, options: { full: boolean; locale?: string }): SummarySection[] {
  const locale = options.locale ?? "en";
  const L = (b: Bi) => pick(b, locale);
  const id = (v: string) => (options.full ? v : maskTaxId(v));
  const pin = (v: string) => (!v ? blank : options.full ? v : "******");
  const blank = t("summary.none");
  const show = (v: string | undefined | null) => (v && v.trim() ? v : blank);
  const yesNo = (v: string) => (v === "yes" ? t("summary.yes") : v === "no" ? t("summary.no") : blank);
  const year = data.taxYear;
  /** Only rows with an answer (sheet questions are mostly optional). */
  const given = (rows: SummaryRow[]) => rows.filter((r) => r.value && r.value !== blank);
  const label = (b: Bi | undefined, fallback: string) => (b ? L(b) : fallback);

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
    { label: L(MAIN.usCitizen), value: yesNo(p.usCitizen) },
    { label: t(spouse ? "fields.spouseBlind" : "fields.blind"), value: yesNo(p.blind) },
    { label: t(spouse ? "fields.spouseClaimedByOther" : "fields.claimedByOther"), value: yesNo(p.claimedByOther) },
  ];

  const tp = data.taxpayer;
  const sections: SummarySection[] = [
    {
      title: t("sections.general.summary"),
      rows: [
        { label: t("fields.taxYear"), value: String(year) },
        { label: t("fields.preferredLanguage"), value: t(`languages.${data.preferredLanguage}`) },
      ],
    },
    {
      title: t("sections.taxpayer.title"),
      rows: [
        ...personRows(tp, false),
        { label: t("summary.address"), value: `${tp.street}${tp.apt ? `, ${tp.apt}` : ""}, ${tp.city}, ${tp.state} ${tp.zip}` },
        ...given([
          { label: L(MAIN.county), value: data.county },
          { label: L(fill(MAIN.multiState, { year })), value: yesNo(data.multiState) },
          { label: L(fill(MAIN.statesDetail, { year })), value: data.statesDetail },
          { label: L(MAIN.housing), value: data.housing ? L(HOUSING_LABELS[data.housing]) : "" },
        ]),
      ],
    },
    {
      title: t("sections.filingStatus.title"),
      rows: [
        { label: t("fields.filingStatus"), value: t(`filingStatus.${data.filingStatus}`) },
        ...given([
          { label: L(fill(MAIN.maritalStatus, { year })), value: data.maritalStatus ? L(MARITAL_LABELS[data.maritalStatus]) : "" },
          { label: L(MAIN.spouseDeathYear), value: data.spouseDeathYear },
        ]),
        ...(data.filingStatus === "unsure" && data.married ? [{ label: t("fields.married"), value: yesNo(data.married) }] : []),
      ],
    },
  ];

  if (data.spouse) sections.push({ title: t("sections.spouse.title"), rows: personRows(data.spouse, true) });
  const ds = data.deceasedSpouse;
  if (ds) {
    sections.push({
      title: t("sections.deceasedSpouse.title"),
      rows: [
        { label: t("fields.firstName"), value: ds.firstName },
        { label: t("fields.middleInitial"), value: show(ds.middleInitial) },
        { label: t("fields.lastName"), value: ds.lastName },
        { label: t("fields.ssn"), value: id(ds.ssn) },
        { label: t("fields.dob"), value: ds.dob },
        { label: t("fields.dateOfDeath"), value: ds.dateOfDeath },
      ],
    });
  }

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
          d.student ? `${L(MAIN.student)} ${yesNo(d.student)}` : "",
          d.disabled ? `${L(MAIN.disabled)} ${yesNo(d.disabled)}` : "",
          d.claimable ? `${L(MAIN.claimable)} ${L(CLAIMABLE_LABELS[d.claimable])}` : "",
        ]
          .filter(Boolean)
          .join(" · "),
      })),
    ],
  });

  const details = data.incomeDetails;
  sections.push({
    title: t("sections.income.title"),
    rows: [
      { label: t("summary.selected"), value: data.income.length ? data.income.map((k) => label(INCOME_LABELS[k], k)).join(", ") : blank },
      ...given([
        { label: L(MAIN.w2Employers), value: details.w2Employers },
        { label: L(MAIN.tipsOvertime), value: yesNo(details.tipsOvertime) },
      ]),
      ...(data.businessDescription ? [{ label: t("fields.businessDescription"), value: data.businessDescription }] : []),
      ...given([
        { label: L(MAIN.keepsRecords), value: yesNo(details.keepsRecords) },
        { label: L(MAIN.necIsBusiness), value: yesNo(details.necIsBusiness) },
        { label: L(MAIN.kIsBusiness), value: yesNo(details.kIsBusiness) },
      ]),
      ...(data.otherIncome ? [{ label: t("fields.otherIncome"), value: data.otherIncome }] : []),
    ],
  });

  sections.push({
    title: t("sections.deductions.title"),
    rows: [
      { label: t("summary.selected"), value: data.deductions.length ? data.deductions.map((k) => label(DEDUCTION_LABELS[k], k)).join(", ") : blank },
      ...(data.childcareProvider ? [{ label: t("fields.childcareProvider"), value: data.childcareProvider }] : []),
      ...data.childcare.map((c, i) => ({
        label: `${L(MAIN.childcareProvider)} ${i + 1}`,
        value: [c.provider, c.ein, formatAmount(c.amount)].filter(Boolean).join(" · "),
      })),
      ...given([{ label: L(MAIN.estimatedDetails), value: data.estimatedDetails }]),
    ],
  });

  sections.push({
    title: t("sections.questions.title"),
    rows: [
      ...(Object.keys(QUESTION_FOLLOW_UP) as (keyof typeof QUESTION_FOLLOW_UP)[]).flatMap((q) => [
        { label: t(`questions.${q}`), value: yesNo(data.questions[q]) },
        ...(data.questionDetails[q] ? [{ label: t(`followUps.${q}`), value: data.questionDetails[q] }] : []),
      ]),
      ...given([
        { label: L(fill(MAIN.dd1, { year })), value: data.dueDiligence.homeCost },
        { label: L(fill(MAIN.dd2, { year })), value: data.dueDiligence.childResidence },
        { label: L(MAIN.dd3), value: yesNo(data.dueDiligence.creditDisallowed) },
        { label: L(MAIN.ddYear), value: data.dueDiligence.disallowedYear },
        { label: L(MAIN.priorReturn), value: yesNo(data.priorReturn) },
        { label: L(MAIN.otherStateLastYear), value: yesNo(data.otherStateLastYear) },
      ]),
    ],
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
      ...given([{ label: L(MAIN.authorizedPerson), value: data.authorizedPerson }]),
    ],
  });

  if (data.notes) sections.push({ title: t("sections.notes.title"), rows: [{ label: t("fields.notes"), value: data.notes }] });

  // Schedule E ---------------------------------------------------------
  const e = data.scheduleE;
  if (e) {
    sections.push({
      title: L(["Schedule E — Rental property, royalties and K-1s", "Anexo E — Propiedad de alquiler, regalías y K-1"]),
      rows: given([
        { label: L(["Owner", "Dueño(a)"]), value: e.owner ? L(OWNER_LABELS[e.owner]!) : "" },
        { label: L(["Ownership %", "% de propiedad"]), value: e.ownershipPct },
        ...E_FLAGS.map(([k, en, es]) => ({ label: L(fill([en, es], { year })), value: yesNo(e[k]) })),
        { label: L(["Improvements, new assets or sales?", "¿Mejoras, activos nuevos o ventas?"]), value: yesNo(e.improvementsMade) },
        ...e.improvements.map((m, i) => ({
          label: `${L(["Improvement", "Mejora"])} ${i + 1}`,
          value: [m.property, m.description, m.date, formatAmount(m.cost), m.type].filter(Boolean).join(" · "),
        })),
        ...e.k1s.map((k, i) => ({
          label: `K-1 ${i + 1}`,
          value: [
            k.entity,
            k.ein,
            k.type,
            k.received ? `${L(["K-1 received?", "¿K-1 recibido?"])} ${yesNo(k.received)}` : "",
            k.materially ? `${L(["Materially participate?", "¿Participa materialmente?"])} ${yesNo(k.materially)}` : "",
            formatAmount(k.basis),
          ]
            .filter(Boolean)
            .join(" · "),
        })),
        { label: L(["Prior-year losses not allowed (Form 8582)?", "¿Pérdidas de años anteriores no permitidas (Formulario 8582)?"]), value: yesNo(e.priorLosses) },
        ...E_DUE_DILIGENCE.map(([k, en, es]) => ({ label: L(fill([en, es], { year })), value: e.dueDiligence[k] })),
      ]),
    });
    e.properties.forEach((p, i) => {
      sections.push({
        title: `${L(["Schedule E", "Anexo E"])} · ${L([`Property ${PROPERTY_LETTERS[i]}`, `Propiedad ${PROPERTY_LETTERS[i]}`])}`,
        rows: given([
          ...E_DETAILS.map(([k, en, es, kind]) => ({ label: L(fill([en, es], { year })), value: kind === "money" ? formatAmount(p[k]) : p[k] })),
          { label: L(["1b · Type of property", "1b · Tipo de propiedad"]), value: p.type ? L(PROPERTY_TYPE_LABELS[p.type]) : "" },
          ...E_PROPERTY_FLAGS.map(([k, en, es]) => ({ label: L([en, es]), value: yesNo(p[k]) })),
          ...E_INCOME.map(([k, en, es]) => ({ label: L(fill([en, es], { year })), value: formatAmount(p[k]) })),
          { label: L(["Form 1099-MISC / 1099-K received?", "¿Recibió Formulario 1099-MISC / 1099-K?"]), value: yesNo(p.form1099) },
          ...E_EXPENSES.map(([k, en, es]) => ({ label: L([en, es]), value: formatAmount(p.expenses[k]) })),
          { label: L(["Total expenses", "Total de gastos"]), value: formatAmount(sumAmounts(Object.values(p.expenses))) },
          { label: L(["13a · Rental use % of the vehicle", "13a · % de uso del vehículo para el alquiler"]), value: p.vehiclePct },
          { label: L(["Last year's depreciation schedule?", "¿Cuadro de depreciación del año pasado?"]), value: yesNo(p.depreciationSchedule) },
        ]),
      });
    });
  }

  // Schedule C ---------------------------------------------------------
  data.businesses.forEach((b, i) => {
    const v = b.vehicleDetail;
    const ho = b.homeOfficeDetail;
    sections.push({
      title: `${L(["Schedule C — Business", "Anexo C — Negocio"])} ${i + 1}`,
      rows: given([
        { label: L(["Owner", "Dueño(a)"]), value: b.owner ? L(OWNER_LABELS[b.owner]!) : "" },
        { label: L(["A · Principal business or profession", "A · Actividad o profesión principal"]), value: b.activity },
        { label: L(["C · Business name", "C · Nombre del negocio"]), value: b.name },
        { label: "D · EIN", value: b.ein },
        { label: L(["Date started / acquired", "Fecha en que empezó / adquirió"]), value: b.started },
        { label: L(["E · Same address as home?", "E · ¿Misma dirección de su casa?"]), value: yesNo(b.sameAddress) },
        { label: L(["Business address", "Dirección del negocio"]), value: b.address },
        { label: L(["F · Accounting method", "F · Método contable"]), value: b.method ? `${L(ACCOUNTING_LABELS[b.method])}${b.methodOther ? ` — ${b.methodOther}` : ""}` : "" },
        ...C_FLAGS.map(([k, en, es]) => ({ label: L(fill([en, es], { year })), value: yesNo(b[k]) })),
        { label: L(["Number of Forms 1099-NEC / 1099-MISC", "Número de Formularios 1099-NEC / 1099-MISC"]), value: b.count1099 },
        { label: L(["Total on Forms 1099-NEC / 1099-MISC", "Total en Formularios 1099-NEC / 1099-MISC"]), value: formatAmount(b.total1099) },
        { label: L(["Forms 1099-K — gross amount", "Formularios 1099-K — monto bruto"]), value: formatAmount(b.gross1099K) },
        { label: L(["1099-K: fees, refunds or personal items included?", "1099-K: ¿incluye comisiones, reembolsos o artículos personales?"]), value: b.k1099Includes },
        { label: L(["Cash, check and app receipts NOT on any 1099", "Cobros en efectivo, cheque y aplicación que NO están en ningún 1099"]), value: formatAmount(b.cashNotOn1099) },
        { label: L(["Income records you keep", "Registros de ingresos que guarda"]), value: b.records.map((k) => L(INCOME_RECORD_LABELS[k])).join(", ") },
        { label: L(["2 · Returns and allowances", "2 · Devoluciones y descuentos"]), value: formatAmount(b.returns) },
        { label: L(["6 · Other business income", "6 · Otros ingresos del negocio"]), value: formatAmount(b.otherIncome) },
        { label: L(["1 · Gross receipts", "1 · Ingresos brutos"]), value: formatAmount(b.grossReceipts) },
        { label: L(["Agrees with bank deposits?", "¿Concuerda con los depósitos?"]), value: yesNo(b.agreesDeposits) },
        ...C_EXPENSES.map(([k, line, en, es]) => ({ label: `${line} · ${L([en, es])}`, value: formatAmount(b.expenses[k]) })),
        { label: L(["Total expenses", "Total de gastos"]), value: formatAmount(sumAmounts(Object.values(b.expenses))) },
        { label: L(["25 · Phone — % business use", "25 · Teléfono — % de uso de negocio"]), value: b.phonePct },
        { label: L(["25 · Internet — % business use", "25 · Internet — % de uso de negocio"]), value: b.internetPct },
        { label: L(["27b · List of other expenses", "27b · Lista de otros gastos"]), value: b.otherList },
        { label: L(["Home office method", "Método de oficina en casa"]), value: ho.method ? L(HOME_OFFICE_METHOD_LABELS[ho.method]) : "" },
        { label: L(["Home / business square feet", "Pies cuadrados casa / negocio"]), value: ho.totalSqft || ho.businessSqft ? `${ho.totalSqft || "?"} / ${ho.businessSqft || "?"}` : "" },
        { label: L(["Months used", "Meses usados"]), value: ho.months },
        { label: L(["Amounts paid for the whole home", "Montos pagados por toda la casa"]), value: ho.homeExpenses },
        { label: L(["Vehicle", "Vehículo"]), value: [v.makeModel, v.placedInService].filter(Boolean).join(" · ") },
        {
          label: L(["Miles: total / business / commuting / other", "Millas: total / negocio / traslado / otras"]),
          value: v.totalMiles || v.businessMiles ? [v.totalMiles, v.businessMiles, v.commutingMiles, v.otherMiles].map((m) => m || "—").join(" / ") : "",
        },
        { label: L(["Mileage log", "Bitácora de millas"]), value: v.log ? L(MILEAGE_LOG_LABELS[v.log]) : "" },
        { label: L(["Written evidence?", "¿Evidencia escrita?"]), value: yesNo(v.writtenEvidence) },
        { label: L(["Available for personal use off duty?", "¿Disponible para uso personal?"]), value: yesNo(v.personalOffDuty) },
        { label: L(["Another vehicle for personal use?", "¿Otro vehículo para uso personal?"]), value: yesNo(v.otherVehicle) },
        { label: L(["Vehicle method", "Método del vehículo"]), value: v.method ? L(VEHICLE_METHOD_LABELS[v.method]) : "" },
        ...VEHICLE_COSTS.map(([k, en, es]) => ({ label: L([en, es]), value: formatAmount(v[k]) })),
        { label: L(["Purchase price / date", "Precio / fecha de compra"]), value: v.purchase },
        { label: L(["Parking and tolls", "Estacionamiento y peajes"]), value: formatAmount(v.parkingTolls) },
        ...COGS_LINES.map(([k, line, en, es]) => ({ label: `${line} · ${L([en, es])}`, value: formatAmount(b.cogs[k]) })),
        ...b.assets.map((a, j) => ({
          label: `${L(["Asset", "Activo"])} ${j + 1}`,
          value: [a.description, a.date, formatAmount(a.cost), a.pct ? `${a.pct} %` : "", a.status ? L(ASSET_STATUS_LABELS[a.status]) : ""].filter(Boolean).join(" · "),
        })),
        ...C_DUE_DILIGENCE.map(([k, en, es]) => ({ label: L([en, es]), value: b.dueDiligence[k] })),
      ]),
    });
  });
  if (data.businesses.length > 0) {
    const shared = data.scheduleCShared;
    const rows = given(C_SHARED.map(([k, en, es]) => ({ label: L(fill([en, es], { year, prev: year - 1 })), value: formatAmount(shared[k]) })));
    if (rows.length) sections.push({ title: L(["Schedule C — Health insurance, retirement and estimated taxes", "Anexo C — Seguro de salud, jubilación e impuestos estimados"]), rows });
  }

  return sections;
}
