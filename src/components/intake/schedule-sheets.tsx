"use client";

import { Info, Plus, Trash2 } from "lucide-react";
import { FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { MAX_ASSETS, MAX_IMPROVEMENTS, MAX_K1S } from "@/lib/intake/schema";
import {
  ACCOUNTING_LABELS,
  ACCOUNTING_METHODS,
  ASSET_STATUS_LABELS,
  ASSET_STATUSES,
  C_DUE_DILIGENCE,
  C_EXPENSES,
  C_FLAGS,
  C_SHARED,
  COGS_LINES,
  E_DETAILS,
  E_DUE_DILIGENCE,
  E_EXPENSES,
  E_FLAGS,
  E_INCOME,
  E_PROPERTY_FLAGS,
  fill,
  formatAmount,
  HOME_OFFICE_METHOD_LABELS,
  HOME_OFFICE_METHODS,
  INCOME_RECORD_LABELS,
  INCOME_RECORDS,
  MAX_BUSINESSES,
  MAX_PROPERTIES,
  MILEAGE_LOG_LABELS,
  MILEAGE_LOGS,
  NO,
  OWNER_LABELS,
  OWNERS_C,
  OWNERS_E,
  pick,
  PROPERTY_LETTERS,
  PROPERTY_TYPE_LABELS,
  PROPERTY_TYPES,
  sumAmounts,
  VEHICLE_COSTS,
  VEHICLE_METHOD_LABELS,
  VEHICLE_METHODS,
  YES,
  type Bi,
} from "@/lib/intake/sheet";
import { cn } from "@/lib/utils";

/**
 * Schedule C (one sheet per business) and Schedule E (rentals, royalties and
 * K-1s) questions of the intake form, with the texts of the paper sheets.
 * Answers are plain JSON trees edited by path; the intake schema validates
 * and normalizes them on both sides.
 */

export type Json = string | string[] | JsonObj | JsonObj[];
export interface JsonObj {
  [key: string]: Json;
}
export type Path = (string | number)[];

export function setIn(obj: Json, path: Path, value: Json): Json {
  if (path.length === 0) return value;
  const [head, ...rest] = path;
  if (Array.isArray(obj)) {
    const copy = [...(obj as JsonObj[])];
    copy[head as number] = setIn(copy[head as number] ?? {}, rest, value) as JsonObj;
    return copy;
  }
  const o = (obj ?? {}) as JsonObj;
  return { ...o, [head as string]: setIn(o[head as string] ?? {}, rest, value) };
}
const getIn = (obj: Json | undefined, path: Path): Json | undefined =>
  path.reduce<Json | undefined>((node, k) => (node && typeof node === "object" ? (node as JsonObj & JsonObj[])[k as never] : undefined), obj);
const str = (obj: Json | undefined, path: Path) => {
  const v = getIn(obj, path);
  return typeof v === "string" ? v : "";
};

/** Drops the React list keys before sending. */
export function withoutKeys(value: Json): Json {
  if (Array.isArray(value)) return (value as Json[]).map((v) => (typeof v === "string" ? v : withoutKeys(v))) as Json;
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([k]) => k !== "key").map(([k, v]) => [k, withoutKeys(v)]));
  return value;
}

const blankRecord = (keys: readonly string[]): JsonObj => Object.fromEntries(keys.map((k) => [k, ""]));
const newKey = () => crypto.randomUUID();

export function emptyBusiness(owner = ""): JsonObj {
  return {
    key: newKey(),
    owner,
    activity: "",
    name: "",
    ein: "",
    started: "",
    sameAddress: "",
    address: "",
    method: "",
    methodOther: "",
    ...blankRecord(C_FLAGS.map(([k]) => k)),
    count1099: "",
    total1099: "",
    gross1099K: "",
    k1099Includes: "",
    cashNotOn1099: "",
    records: [],
    returns: "",
    otherIncome: "",
    grossReceipts: "",
    agreesDeposits: "",
    expenses: blankRecord(C_EXPENSES.map(([k]) => k)),
    phonePct: "",
    internetPct: "",
    otherList: "",
    homeOfficeDetail: blankRecord(["method", "totalSqft", "businessSqft", "months", "homeExpenses"]),
    vehicleDetail: blankRecord([
      "makeModel",
      "placedInService",
      "totalMiles",
      "businessMiles",
      "commutingMiles",
      "otherMiles",
      "log",
      "writtenEvidence",
      "personalOffDuty",
      "otherVehicle",
      "method",
      ...VEHICLE_COSTS.map(([k]) => k),
      "purchase",
      "parkingTolls",
    ]),
    cogs: blankRecord(COGS_LINES.map(([k]) => k)),
    assets: [],
    dueDiligence: blankRecord(C_DUE_DILIGENCE.map(([k]) => k)),
  };
}
export const emptyScheduleCShared = (): JsonObj => blankRecord(C_SHARED.map(([k]) => k));

export function emptyProperty(): JsonObj {
  return {
    key: newKey(),
    ...blankRecord(E_DETAILS.map(([k]) => k)),
    type: "",
    ...blankRecord(E_PROPERTY_FLAGS.map(([k]) => k)),
    ...blankRecord(E_INCOME.map(([k]) => k)),
    form1099: "",
    expenses: blankRecord(E_EXPENSES.map(([k]) => k)),
    vehiclePct: "",
    depreciationSchedule: "",
  };
}
export function emptyScheduleE(owner = ""): JsonObj {
  return {
    owner,
    ownershipPct: "",
    ...blankRecord(E_FLAGS.map(([k]) => k)),
    properties: [],
    improvementsMade: "",
    improvements: [],
    k1s: [],
    priorLosses: "",
    dueDiligence: blankRecord(E_DUE_DILIGENCE.map(([k]) => k)),
  };
}

// --------------------------------------------------------------- inputs
type Ctx = {
  locale: string;
  year: number;
  idPrefix: string;
  /** Error text for a full path ("businesses.0.activity"), if any. */
  err: (path: string) => string | undefined;
};
type Kind = "text" | "money" | "date" | "count" | "percent";

const L = (ctx: Ctx, b: Bi) => pick(b, ctx.locale);
const keyOf = (path: Path) => path.join(".");
const idOf = (ctx: Ctx, path: Path) => `${ctx.idPrefix}-${path.join("-")}`;

function Field({
  ctx,
  path,
  label,
  value,
  onChange,
  kind = "text",
  required,
  className,
  maxLength = 120,
}: {
  ctx: Ctx;
  path: Path;
  label: string;
  value: string;
  onChange: (v: string) => void;
  kind?: Kind;
  required?: boolean;
  className?: string;
  maxLength?: number;
}) {
  const props =
    kind === "money"
      ? { inputMode: "decimal" as const, placeholder: "$0.00", maxLength: 16 }
      : kind === "date"
        ? { type: "date", max: new Date().toISOString().slice(0, 10) }
        : kind === "count"
          ? { inputMode: "numeric" as const, maxLength: 7 }
          : kind === "percent"
            ? { inputMode: "decimal" as const, placeholder: "%", maxLength: 6 }
            : { maxLength };
  return (
    <FormField
      className={className}
      id={idOf(ctx, path)}
      name={keyOf(path)}
      label={label}
      required={required}
      autoComplete="off"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      error={ctx.err(keyOf(path))}
      {...props}
    />
  );
}

function Area({ ctx, path, label, value, onChange }: { ctx: Ctx; path: Path; label: string; value: string; onChange: (v: string) => void }) {
  const id = idOf(ctx, path);
  const error = ctx.err(keyOf(path));
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Textarea id={id} rows={2} maxLength={500} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={error ? true : undefined} className="bg-white" />
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

/** A question answered with radio buttons on one line. */
export function RadioRow({
  ctx,
  path,
  label,
  value,
  onChange,
  options,
  required = false,
}: {
  ctx: Ctx;
  path: Path;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: Bi }[];
  required?: boolean;
}) {
  const error = ctx.err(keyOf(path));
  return (
    <fieldset
      aria-invalid={error ? true : undefined}
      className={cn(
        "flex flex-col gap-2 rounded-2xl border px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between",
        error ? "border-destructive" : "border-azure-50",
      )}
    >
      <legend className="sr-only">{label}</legend>
      <p aria-hidden="true" className="text-sm sm:max-w-[70%]">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </p>
      <div className="flex shrink-0 flex-wrap gap-x-5 gap-y-2 text-sm">
        {options.map((o) => (
          <label key={o.value} className="flex cursor-pointer items-center gap-2">
            <input type="radio" name={idOf(ctx, path)} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="size-4 accent-electric" />
            {L(ctx, o.label)}
          </label>
        ))}
      </div>
      {error ? <p role="alert" className="text-sm text-destructive sm:basis-full">{error}</p> : null}
    </fieldset>
  );
}
const yesNoOptions = [
  { value: "yes", label: YES },
  { value: "no", label: NO },
];
function YesNo(props: { ctx: Ctx; path: Path; label: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return <RadioRow {...props} options={yesNoOptions} />;
}

function Select({
  ctx,
  path,
  label,
  value,
  onChange,
  options,
  className,
}: {
  ctx: Ctx;
  path: Path;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  const id = idOf(ctx, path);
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      <NativeSelect id={id} value={value} onChange={(e) => onChange(e.target.value)} className="bg-background">
        <option value="">{L(ctx, ["Select…", "Seleccione…"])}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}

function Part({ letter, title, children, note }: { letter: string; title: string; children: React.ReactNode; note?: string }) {
  return (
    <section className="space-y-4">
      <h3 className="flex items-center gap-3 text-sm font-semibold tracking-wide text-ink uppercase">
        <span className="text-electric">{letter}</span>
        {title}
        <span aria-hidden="true" className="h-px flex-1 bg-azure-50" />
      </h3>
      {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
      {children}
    </section>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex gap-2 rounded-2xl border-l-4 border-electric bg-azure-25 p-3 text-xs text-graphite">
      <Info aria-hidden="true" className="size-4 shrink-0 text-electric" />
      <span>{children}</span>
    </p>
  );
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-mist px-4 py-3 text-sm">
      <span className="font-medium text-ink">{label}</span>
      <span aria-live="polite" className="font-semibold tabular-nums text-ink">
        {formatAmount(value) || "$0.00"}
      </span>
    </div>
  );
}

/** Money values that are not valid yet count as 0 in the live totals. */
const amount = (v: string) => {
  const clean = v.replace(/[$,\s]/g, "");
  return /^-?\d+(\.\d+)?$/.test(clean) ? clean : "";
};

function RowList({
  ctx,
  path,
  items,
  max,
  addLabel,
  onAdd,
  onRemove,
  render,
  title,
}: {
  ctx: Ctx;
  path: Path;
  items: JsonObj[];
  max: number;
  addLabel: string;
  onAdd: () => void;
  onRemove: (i: number) => void;
  render: (item: JsonObj, i: number) => React.ReactNode;
  title: (i: number) => string;
}) {
  const error = ctx.err(keyOf(path));
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <fieldset key={String(item.key)} className="space-y-4 rounded-2xl border border-azure-50 bg-mist p-4">
          <div className="flex items-center justify-between gap-2">
            <legend className="font-medium">{title(i)}</legend>
            <Button type="button" variant="ghost" size="sm" onClick={() => onRemove(i)}>
              <Trash2 aria-hidden="true" />
              {L(ctx, ["Remove", "Quitar"])}
            </Button>
          </div>
          {render(item, i)}
        </fieldset>
      ))}
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {items.length < max ? (
        <Button type="button" variant="outline" size="sm" className="bg-white" onClick={onAdd}>
          <Plus aria-hidden="true" />
          {addLabel}
        </Button>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------ Schedule C
export function ScheduleCEditor({
  ctx,
  businesses,
  shared,
  showOwner,
  ownerDefault,
  onChange,
  onSharedChange,
}: {
  ctx: Ctx;
  businesses: JsonObj[];
  shared: JsonObj;
  /** Married: the business may belong to the spouse. */
  showOwner: boolean;
  ownerDefault: string;
  onChange: (next: JsonObj[]) => void;
  onSharedChange: (next: JsonObj) => void;
}) {
  const year = ctx.year;
  const setB = (i: number, path: Path, v: Json) => onChange(setIn(businesses, [i, ...path], v) as JsonObj[]);
  const t = (b: Bi) => L(ctx, b);

  return (
    <div className="space-y-6">
      <Note>
        {t([
          "One sheet per business. Answer what you know; your preparer will review the rest with you. Amounts are for the whole year, from your records.",
          "Una hoja por negocio. Responda lo que sepa; su preparador revisará el resto con usted. Los montos son de todo el año, según sus registros.",
        ])}
      </Note>
      <RowList
        ctx={ctx}
        path={["businesses"]}
        items={businesses}
        max={MAX_BUSINESSES}
        addLabel={t(["Add another business", "Agregar otro negocio"])}
        onAdd={() => onChange([...businesses, emptyBusiness(ownerDefault)])}
        onRemove={(i) => onChange(businesses.filter((_, j) => j !== i))}
        title={(i) => `${t(["Business", "Negocio"])} ${i + 1}`}
        render={(b, i) => {
          const p = (...rest: Path): Path => ["businesses", i, ...rest];
          const v = (...rest: Path) => str(b, rest);
          const set = (...rest: Path) => (value: Json) => setB(i, rest, value);
          const records = (getIn(b, ["records"]) as string[] | undefined) ?? [];
          const assets = (getIn(b, ["assets"]) as JsonObj[] | undefined) ?? [];
          const expenseTotal = sumAmounts(C_EXPENSES.map(([k]) => amount(v("expenses", k))));
          const cogs = (() => {
            const plus = sumAmounts(["beginning", "purchases", "labor", "materials"].map((k) => amount(v("cogs", k))));
            const end = amount(v("cogs", "ending"));
            return plus === "" && end === "" ? "" : sumAmounts([plus || "0", end ? String(-Number(end)) : "0"]);
          })();
          return (
            <div className="space-y-8 bg-white/0">
              <Part letter="A" title={t(["The business (lines A–J)", "El negocio (líneas A–J)"])}>
                {showOwner ? (
                  <RadioRow
                    ctx={ctx}
                    path={p("owner")}
                    label={t(["Owner", "Dueño(a)"])}
                    value={v("owner")}
                    onChange={set("owner")}
                    options={OWNERS_C.map((o) => ({ value: o, label: OWNER_LABELS[o]! }))}
                    required
                  />
                ) : null}
                <div className="grid gap-4 sm:grid-cols-4">
                  <Field
                    ctx={ctx}
                    className="sm:col-span-4"
                    path={p("activity")}
                    label={t(["A · Principal business or profession, including product or service", "A · Actividad o profesión principal, incluido el producto o servicio"])}
                    value={v("activity")}
                    onChange={set("activity")}
                    required
                    maxLength={160}
                  />
                  <Field ctx={ctx} className="sm:col-span-2" path={p("name")} label={t(["C · Business name (blank if none)", "C · Nombre del negocio (en blanco si no tiene)"])} value={v("name")} onChange={set("name")} maxLength={100} />
                  <Field ctx={ctx} path={p("ein")} label={t(["D · EIN (blank if none)", "D · EIN (en blanco si no tiene)"])} value={v("ein")} onChange={set("ein")} maxLength={10} />
                  <Field ctx={ctx} path={p("started")} kind="date" label={t(["Date started / acquired", "Fecha en que empezó / adquirió"])} value={v("started")} onChange={set("started")} />
                </div>
                <YesNo ctx={ctx} path={p("sameAddress")} label={t(["E · Is the business address the same as your home?", "E · ¿La dirección del negocio es la misma de su casa?"])} value={v("sameAddress")} onChange={set("sameAddress")} />
                {v("sameAddress") === "no" ? <Field ctx={ctx} path={p("address")} label={t(["Business address", "Dirección del negocio"])} value={v("address")} onChange={set("address")} maxLength={160} /> : null}
                <RadioRow
                  ctx={ctx}
                  path={p("method")}
                  label={t(["F · Accounting method", "F · Método contable"])}
                  value={v("method")}
                  onChange={set("method")}
                  options={ACCOUNTING_METHODS.map((m) => ({ value: m, label: ACCOUNTING_LABELS[m] }))}
                />
                {v("method") === "other" ? <Field ctx={ctx} path={p("methodOther")} label={t(["Describe", "Describa"])} value={v("methodOther")} onChange={set("methodOther")} maxLength={80} /> : null}
                <div className="space-y-2">
                  {C_FLAGS.map(([k, en, es]) => (
                    <YesNo key={k} ctx={ctx} path={p(k)} label={t(fill([en, es], { year }))} value={v(k)} onChange={set(k)} />
                  ))}
                </div>
              </Part>

              <Part letter="B" title={t(["Income (Part I)", "Ingresos (Parte I)"])}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field ctx={ctx} path={p("count1099")} kind="count" label={t(["Number of Forms 1099-NEC / 1099-MISC", "Número de Formularios 1099-NEC / 1099-MISC"])} value={v("count1099")} onChange={set("count1099")} />
                  <Field ctx={ctx} path={p("total1099")} kind="money" label={t(["Total on Forms 1099-NEC / 1099-MISC", "Total en Formularios 1099-NEC / 1099-MISC"])} value={v("total1099")} onChange={set("total1099")} />
                  <Field ctx={ctx} path={p("gross1099K")} kind="money" label={t(["Forms 1099-K (apps, cards, marketplaces) — gross amount", "Formularios 1099-K (aplicaciones, tarjetas, plataformas) — monto bruto"])} value={v("gross1099K")} onChange={set("gross1099K")} />
                  <Field ctx={ctx} path={p("k1099Includes")} label={t(["1099-K: fees, refunds or personal items included?", "1099-K: ¿incluye comisiones, reembolsos o artículos personales?"])} value={v("k1099Includes")} onChange={set("k1099Includes")} maxLength={200} />
                  <Field ctx={ctx} path={p("cashNotOn1099")} kind="money" label={t(["Cash, check and app receipts NOT on any 1099", "Cobros en efectivo, cheque y aplicación que NO están en ningún 1099"])} value={v("cashNotOn1099")} onChange={set("cashNotOn1099")} />
                  <fieldset className="space-y-2">
                    <legend className="text-sm font-medium">{t(["Income records you keep", "Registros de ingresos que guarda"])}</legend>
                    <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                      {INCOME_RECORDS.map((r) => (
                        <label key={r} className="flex cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            className="size-4 accent-electric"
                            checked={records.includes(r)}
                            onChange={() => set("records")(records.includes(r) ? records.filter((x) => x !== r) : [...records, r])}
                          />
                          {t(INCOME_RECORD_LABELS[r])}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <Field ctx={ctx} path={p("returns")} kind="money" label={t(["2 · Returns and allowances (refunds to customers)", "2 · Devoluciones y descuentos (reembolsos a clientes)"])} value={v("returns")} onChange={set("returns")} />
                  <Field ctx={ctx} path={p("otherIncome")} kind="money" label={t(["6 · Other business income (fuel tax credit, recovered bad debts, prizes)", "6 · Otros ingresos del negocio (crédito de combustible, deudas recuperadas, premios)"])} value={v("otherIncome")} onChange={set("otherIncome")} />
                  <Field ctx={ctx} path={p("grossReceipts")} kind="money" label={t(["1 · Gross receipts — the total of everything received", "1 · Ingresos brutos — el total de todo lo recibido"])} value={v("grossReceipts")} onChange={set("grossReceipts")} />
                </div>
                <YesNo ctx={ctx} path={p("agreesDeposits")} label={t(["Does the total agree with your bank deposits?", "¿El total concuerda con sus depósitos bancarios?"])} value={v("agreesDeposits")} onChange={set("agreesDeposits")} />
              </Part>

              <Part letter="D" title={t([`Expenses (Part II) — paid in ${year}, for the business`, `Gastos (Parte II) — pagados en ${year}, para el negocio`])}>
                <div className="grid gap-4 sm:grid-cols-2">
                  {C_EXPENSES.map(([k, line, en, es]) => (
                    <Field key={k} ctx={ctx} path={p("expenses", k)} kind="money" label={`${line} · ${t([en, es])}`} value={v("expenses", k)} onChange={set("expenses", k)} />
                  ))}
                </div>
                <Total label={t(["Total expenses (without vehicle, home office and depreciation)", "Total de gastos (sin vehículo, oficina en casa ni depreciación)"])} value={expenseTotal} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field ctx={ctx} path={p("phonePct")} kind="percent" label={t(["25 · Phone — % business use", "25 · Teléfono — % de uso de negocio"])} value={v("phonePct")} onChange={set("phonePct")} />
                  <Field ctx={ctx} path={p("internetPct")} kind="percent" label={t(["25 · Internet — % business use", "25 · Internet — % de uso de negocio"])} value={v("internetPct")} onChange={set("internetPct")} />
                </div>
                <Area ctx={ctx} path={p("otherList")} label={t(["27b · List of other expenses", "27b · Lista de otros gastos"])} value={v("otherList")} onChange={set("otherList")} />
                <Note>
                  {t([
                    "Not deductible — do not list: commuting to a job, meals alone, fines and tickets, everyday clothing, your own labor or money you took out of the business, loan principal, federal income tax, life insurance.",
                    "No deducibles — no los anote: traslado a un empleo, comidas a solas, multas, ropa de uso diario, su propio trabajo o el dinero que retiró del negocio, el capital de un préstamo, el impuesto federal sobre la renta, el seguro de vida.",
                  ])}
                </Note>
              </Part>

              {v("homeOffice") === "yes" ? (
                <Part letter="E" title={t(["Home office (line 30)", "Oficina en casa (línea 30)"])}>
                  <RadioRow
                    ctx={ctx}
                    path={p("homeOfficeDetail", "method")}
                    label={t(["Method", "Método"])}
                    value={v("homeOfficeDetail", "method")}
                    onChange={set("homeOfficeDetail", "method")}
                    options={HOME_OFFICE_METHODS.map((m) => ({ value: m, label: HOME_OFFICE_METHOD_LABELS[m] }))}
                  />
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field ctx={ctx} path={p("homeOfficeDetail", "totalSqft")} kind="count" label={t(["Total square feet of the home", "Pies cuadrados totales de la casa"])} value={v("homeOfficeDetail", "totalSqft")} onChange={set("homeOfficeDetail", "totalSqft")} />
                    <Field ctx={ctx} path={p("homeOfficeDetail", "businessSqft")} kind="count" label={t(["Square feet used for business", "Pies cuadrados usados para el negocio"])} value={v("homeOfficeDetail", "businessSqft")} onChange={set("homeOfficeDetail", "businessSqft")} />
                    <Field ctx={ctx} path={p("homeOfficeDetail", "months")} kind="count" label={t([`Months used in ${year}`, `Meses usados en ${year}`])} value={v("homeOfficeDetail", "months")} onChange={set("homeOfficeDetail", "months")} />
                  </div>
                  <Area
                    ctx={ctx}
                    path={p("homeOfficeDetail", "homeExpenses")}
                    label={t([
                      "Amounts paid for the whole home (rent or mortgage interest, utilities, insurance, repairs, property tax)",
                      "Montos pagados por toda la casa (renta o intereses hipotecarios, servicios, seguro, reparaciones, impuesto a la propiedad)",
                    ])}
                    value={v("homeOfficeDetail", "homeExpenses")}
                    onChange={set("homeOfficeDetail", "homeExpenses")}
                  />
                </Part>
              ) : null}

              {v("vehicle") === "yes" ? (
                <Part letter="F" title={t(["Vehicle (line 9 and Part IV)", "Vehículo (línea 9 y Parte IV)"])}>
                  <div className="grid gap-4 sm:grid-cols-4">
                    <Field ctx={ctx} className="sm:col-span-2" path={p("vehicleDetail", "makeModel")} label={t(["Year, make and model", "Año, marca y modelo"])} value={v("vehicleDetail", "makeModel")} onChange={set("vehicleDetail", "makeModel")} maxLength={80} />
                    <Field ctx={ctx} className="sm:col-span-2" path={p("vehicleDetail", "placedInService")} kind="date" label={t(["43 · Date placed in service for the business", "43 · Fecha en que empezó a usarlo para el negocio"])} value={v("vehicleDetail", "placedInService")} onChange={set("vehicleDetail", "placedInService")} />
                    {(
                      [
                        ["totalMiles", [`Total miles driven in ${year}`, `Millas totales manejadas en ${year}`]],
                        ["businessMiles", ["44a · Business miles", "44a · Millas de negocio"]],
                        ["commutingMiles", ["44b · Commuting miles", "44b · Millas de traslado"]],
                        ["otherMiles", ["44c · Other miles", "44c · Otras millas"]],
                      ] as const
                    ).map(([k, label]) => (
                      <Field key={k} ctx={ctx} path={p("vehicleDetail", k)} kind="count" label={t(label)} value={v("vehicleDetail", k)} onChange={set("vehicleDetail", k)} />
                    ))}
                  </div>
                  <RadioRow
                    ctx={ctx}
                    path={p("vehicleDetail", "log")}
                    label={t(["Mileage log kept?", "¿Lleva bitácora de millas?"])}
                    value={v("vehicleDetail", "log")}
                    onChange={set("vehicleDetail", "log")}
                    options={MILEAGE_LOGS.map((m) => ({ value: m, label: MILEAGE_LOG_LABELS[m] }))}
                  />
                  <YesNo ctx={ctx} path={p("vehicleDetail", "writtenEvidence")} label={t(["47a/47b · Written evidence to support the deduction?", "47a/47b · ¿Evidencia escrita que respalde la deducción?"])} value={v("vehicleDetail", "writtenEvidence")} onChange={set("vehicleDetail", "writtenEvidence")} />
                  <YesNo ctx={ctx} path={p("vehicleDetail", "personalOffDuty")} label={t(["45 · Available for personal use off duty?", "45 · ¿Disponible para uso personal fuera del trabajo?"])} value={v("vehicleDetail", "personalOffDuty")} onChange={set("vehicleDetail", "personalOffDuty")} />
                  <YesNo ctx={ctx} path={p("vehicleDetail", "otherVehicle")} label={t(["46 · Another vehicle available for personal use?", "46 · ¿Hay otro vehículo para uso personal?"])} value={v("vehicleDetail", "otherVehicle")} onChange={set("vehicleDetail", "otherVehicle")} />
                  <RadioRow
                    ctx={ctx}
                    path={p("vehicleDetail", "method")}
                    label={t(["Method", "Método"])}
                    value={v("vehicleDetail", "method")}
                    onChange={set("vehicleDetail", "method")}
                    options={VEHICLE_METHODS.map((m) => ({ value: m, label: VEHICLE_METHOD_LABELS[m] }))}
                  />
                  {v("vehicleDetail", "method") === "actual" ? (
                    <div className="grid gap-4 sm:grid-cols-3">
                      {VEHICLE_COSTS.map(([k, en, es]) => (
                        <Field key={k} ctx={ctx} path={p("vehicleDetail", k)} kind="money" label={t([en, es])} value={v("vehicleDetail", k)} onChange={set("vehicleDetail", k)} />
                      ))}
                      <Field ctx={ctx} className="sm:col-span-3" path={p("vehicleDetail", "purchase")} label={t(["Purchase price / date", "Precio / fecha de compra"])} value={v("vehicleDetail", "purchase")} onChange={set("vehicleDetail", "purchase")} maxLength={80} />
                    </div>
                  ) : null}
                  <Field ctx={ctx} path={p("vehicleDetail", "parkingTolls")} kind="money" label={t(["Parking and tolls for business trips (either method)", "Estacionamiento y peajes de viajes de negocio (cualquier método)"])} value={v("vehicleDetail", "parkingTolls")} onChange={set("vehicleDetail", "parkingTolls")} />
                </Part>
              ) : null}

              {v("inventory") === "yes" ? (
                <Part letter="G" title={t(["Cost of goods sold (Part III)", "Costo de los bienes vendidos (Parte III)"])}>
                  <div className="grid gap-4 sm:grid-cols-3">
                    {COGS_LINES.map(([k, line, en, es]) => (
                      <Field key={k} ctx={ctx} path={p("cogs", k)} kind="money" label={`${line} · ${t([en, es])}`} value={v("cogs", k)} onChange={set("cogs", k)} />
                    ))}
                  </div>
                  <Total label={t(["42 · Cost of goods sold (35 + 36 + 37 + 38 − 41)", "42 · Costo de los bienes vendidos (35 + 36 + 37 + 38 − 41)"])} value={cogs} />
                </Part>
              ) : null}

              {v("equipment") === "yes" ? (
                <Part letter="H" title={t([`Equipment, tools and other assets bought or sold in ${year}`, `Equipo, herramientas y otros activos comprados o vendidos en ${year}`])}>
                  <RowList
                    ctx={ctx}
                    path={p("assets")}
                    items={assets}
                    max={MAX_ASSETS}
                    addLabel={t(["Add an item", "Agregar un artículo"])}
                    onAdd={() => set("assets")([...assets, { key: newKey(), description: "", date: "", cost: "", pct: "", status: "" }])}
                    onRemove={(j) => set("assets")(assets.filter((_, x) => x !== j))}
                    title={(j) => `${t(["Item", "Artículo"])} ${j + 1}`}
                    render={(a, j) => (
                      <div className="grid gap-4 sm:grid-cols-4">
                        <Field ctx={ctx} className="sm:col-span-4" path={p("assets", j, "description")} label={t(["Description", "Descripción"])} value={str(a, ["description"])} onChange={set("assets", j, "description")} required />
                        <Field ctx={ctx} path={p("assets", j, "date")} kind="date" label={t(["Date bought or sold", "Fecha de compra o venta"])} value={str(a, ["date"])} onChange={set("assets", j, "date")} />
                        <Field ctx={ctx} path={p("assets", j, "cost")} kind="money" label={t(["Cost or sale price", "Costo o precio de venta"])} value={str(a, ["cost"])} onChange={set("assets", j, "cost")} />
                        <Field ctx={ctx} path={p("assets", j, "pct")} kind="percent" label={t(["Business use %", "% de uso de negocio"])} value={str(a, ["pct"])} onChange={set("assets", j, "pct")} />
                        <Select
                          ctx={ctx}
                          path={p("assets", j, "status")}
                          label={t(["New / used / sold", "Nuevo / usado / vendido"])}
                          value={str(a, ["status"])}
                          onChange={set("assets", j, "status")}
                          options={ASSET_STATUSES.map((s) => ({ value: s, label: t(ASSET_STATUS_LABELS[s]) }))}
                        />
                      </div>
                    )}
                  />
                  <Note>
                    {t([
                      "Items over $2,500 each are depreciated (the preparer decides Section 179 / bonus); smaller tools go to other expenses.",
                      "Los artículos de más de $2,500 cada uno se deprecian (el preparador decide la Sección 179 / bonificación); las herramientas pequeñas van a otros gastos.",
                    ])}
                  </Note>
                </Part>
              ) : null}

              <Part letter="J" title={t(["Due-diligence questions", "Preguntas de debida diligencia"])} note={t(["You can answer now or during the interview", "Puede responder ahora o en la entrevista"])}>
                {C_DUE_DILIGENCE.map(([k, en, es]) => (
                  <Area key={k} ctx={ctx} path={p("dueDiligence", k)} label={t([en, es])} value={v("dueDiligence", k)} onChange={set("dueDiligence", k)} />
                ))}
              </Part>
            </div>
          );
        }}
      />

      <section className="space-y-4 rounded-2xl border border-azure-50 p-4">
        <Part
          letter="I"
          title={t(["Health insurance, retirement and estimated taxes", "Seguro de salud, jubilación e impuestos estimados"])}
          note={t(["Applies to all your businesses. Leave blank what does not apply.", "Aplica a todos sus negocios. Deje en blanco lo que no aplique."])}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {C_SHARED.map(([k, en, es]) => (
              <Field
                key={k}
                ctx={ctx}
                path={["scheduleCShared", k]}
                kind="money"
                label={t(fill([en, es], { year, prev: year - 1 }))}
                value={str(shared, [k])}
                onChange={(value) => onSharedChange({ ...shared, [k]: value })}
              />
            ))}
          </div>
        </Part>
      </section>
    </div>
  );
}

// ------------------------------------------------------------ Schedule E
export function ScheduleEEditor({
  ctx,
  value,
  showOwner,
  showProperties,
  showK1s,
  onChange,
}: {
  ctx: Ctx;
  value: JsonObj;
  showOwner: boolean;
  /** Rentals or royalties: reported per property. */
  showProperties: boolean;
  showK1s: boolean;
  onChange: (next: JsonObj) => void;
}) {
  const year = ctx.year;
  const t = (b: Bi) => L(ctx, b);
  const v = (...path: Path) => str(value, path);
  const set = (...path: Path) => (next: Json) => onChange(setIn(value, path, next) as JsonObj);
  const p = (...rest: Path): Path => ["scheduleE", ...rest];
  const properties = (getIn(value, ["properties"]) as JsonObj[] | undefined) ?? [];
  const improvements = (getIn(value, ["improvements"]) as JsonObj[] | undefined) ?? [];
  const k1s = (getIn(value, ["k1s"]) as JsonObj[] | undefined) ?? [];

  return (
    <div className="space-y-8">
      <Note>
        {t([
          "Answer what you know; your preparer will review the rest with you. Amounts are what was received or paid during the year, with receipts.",
          "Responda lo que sepa; su preparador revisará el resto con usted. Los montos son lo recibido o pagado durante el año, con recibos.",
        ])}
      </Note>
      <Part letter="A" title={t(["General questions", "Preguntas generales"])}>
        {showOwner ? (
          <RadioRow
            ctx={ctx}
            path={p("owner")}
            label={t(["Owner", "Dueño(a)"])}
            value={v("owner")}
            onChange={set("owner")}
            options={OWNERS_E.map((o) => ({ value: o, label: OWNER_LABELS[o]! }))}
            required
          />
        ) : null}
        <Field ctx={ctx} className="sm:max-w-xs" path={p("ownershipPct")} kind="percent" label={t(["Ownership % (if not 100 %)", "% de propiedad (si no es 100 %)"])} value={v("ownershipPct")} onChange={set("ownershipPct")} />
        <div className="space-y-2">
          {E_FLAGS.map(([k, en, es]) => (
            <div key={k} className="space-y-2">
              <YesNo ctx={ctx} path={p(k)} label={t(fill([en, es], { year }))} value={v(k)} onChange={set(k)} />
              {k === "shortTerm" && v(k) === "yes" ? (
                <Note>{t(["This may belong on Schedule C instead — your preparer will review it with you.", "Esto podría ir en el Anexo C — su preparador lo revisará con usted."])}</Note>
              ) : null}
            </div>
          ))}
        </div>
      </Part>

      {showProperties ? (
        <Part letter="B" title={t(["Properties (lines 1–19)", "Propiedades (líneas 1–19)"])}>
          <RowList
            ctx={ctx}
            path={p("properties")}
            items={properties}
            max={MAX_PROPERTIES}
            addLabel={t(["Add a property", "Agregar una propiedad"])}
            onAdd={() => set("properties")([...properties, emptyProperty()])}
            onRemove={(i) => set("properties")(properties.filter((_, j) => j !== i))}
            title={(i) => t([`Property ${PROPERTY_LETTERS[i]}`, `Propiedad ${PROPERTY_LETTERS[i]}`])}
            render={(prop, i) => {
              const pp = (...rest: Path): Path => p("properties", i, ...rest);
              const pv = (...rest: Path) => str(prop, rest);
              const ps = (...rest: Path) => set("properties", i, ...rest);
              const total = sumAmounts(E_EXPENSES.map(([k]) => amount(pv("expenses", k))));
              return (
                <div className="space-y-6">
                  <div className="grid gap-4 sm:grid-cols-4">
                    {E_DETAILS.map(([k, en, es, kind]) => (
                      <Field
                        key={k}
                        ctx={ctx}
                        className={k === "address" ? "sm:col-span-4" : k === "describe" || k === "lender" ? "sm:col-span-2" : undefined}
                        path={pp(k)}
                        kind={kind === "days" || kind === "months" ? "count" : kind}
                        label={t(fill([en, es], { year }))}
                        value={pv(k)}
                        onChange={ps(k)}
                        required={k === "address"}
                        maxLength={k === "address" ? 160 : 120}
                      />
                    ))}
                    <Select
                      ctx={ctx}
                      className="sm:col-span-2"
                      path={pp("type")}
                      label={t(["1b · Type of property", "1b · Tipo de propiedad"])}
                      value={pv("type")}
                      onChange={ps("type")}
                      options={PROPERTY_TYPES.map((k) => ({ value: k, label: t(PROPERTY_TYPE_LABELS[k]) }))}
                    />
                  </div>
                  <div className="space-y-2">
                    {E_PROPERTY_FLAGS.map(([k, en, es]) => (
                      <YesNo key={k} ctx={ctx} path={pp(k)} label={t([en, es])} value={pv(k)} onChange={ps(k)} />
                    ))}
                  </div>
                  <h4 className="text-sm font-semibold text-ink">{t([`Income — everything received in ${year}`, `Ingresos — todo lo recibido en ${year}`])}</h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {E_INCOME.map(([k, en, es]) => (
                      <Field key={k} ctx={ctx} path={pp(k)} kind="money" label={t(fill([en, es], { year }))} value={pv(k)} onChange={ps(k)} />
                    ))}
                  </div>
                  <YesNo ctx={ctx} path={pp("form1099")} label={t(["Form 1099-MISC / 1099-K received?", "¿Recibió Formulario 1099-MISC / 1099-K?"])} value={pv("form1099")} onChange={ps("form1099")} />
                  <Note>{t(["Rent is income when received, whatever the lease says.", "La renta es ingreso cuando se recibe, diga lo que diga el contrato."])}</Note>
                  <h4 className="text-sm font-semibold text-ink">{t([`Expenses paid in ${year}, with receipts`, `Gastos pagados en ${year}, con recibos`])}</h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {E_EXPENSES.map(([k, en, es]) => (
                      <Field key={k} ctx={ctx} path={pp("expenses", k)} kind="money" label={t([en, es])} value={pv("expenses", k)} onChange={ps("expenses", k)} />
                    ))}
                    <Field ctx={ctx} path={pp("vehiclePct")} kind="percent" label={t(["13a · Rental use % of the vehicle", "13a · % de uso del vehículo para el alquiler"])} value={pv("vehiclePct")} onChange={ps("vehiclePct")} />
                  </div>
                  <Total label={t(["Total expenses", "Total de gastos"])} value={total} />
                  <YesNo
                    ctx={ctx}
                    path={pp("depreciationSchedule")}
                    label={t(["18 · Depreciation is calculated by the preparer — do you have last year's depreciation schedule?", "18 · La depreciación la calcula el preparador — ¿tiene el cuadro de depreciación del año pasado?"])}
                    value={pv("depreciationSchedule")}
                    onChange={ps("depreciationSchedule")}
                  />
                </div>
              );
            }}
          />
          <Note>
            {t([
              "Not deductible: loan principal, the land, your own labor, the personal-use share, improvements (listed below and depreciated).",
              "No deducibles: el capital del préstamo, el terreno, su propio trabajo, la parte de uso personal, las mejoras (se anotan abajo y se deprecian).",
            ])}
          </Note>
        </Part>
      ) : null}

      <Part letter="E" title={t([`Improvements, new assets and sales in ${year}`, `Mejoras, activos nuevos y ventas en ${year}`])}>
        <YesNo
          ctx={ctx}
          path={p("improvementsMade")}
          label={t([`Did you make improvements, buy assets, or sell or convert a rental in ${year}?`, `¿Hizo mejoras, compró activos, o vendió o convirtió un alquiler en ${year}?`])}
          value={v("improvementsMade")}
          onChange={set("improvementsMade")}
        />
        {v("improvementsMade") === "yes" ? (
          <>
            <Note>
              {t([
                "Repairs keep the property working; improvements add value or extend its life (roof, HVAC, remodel, appliances). Sold a rental? Bring the closing statement, Form 1099-S and the original purchase documents.",
                "Las reparaciones mantienen la propiedad; las mejoras agregan valor o alargan su vida (techo, calefacción/aire, remodelación, electrodomésticos). ¿Vendió un alquiler? Traiga el estado de cierre, el Formulario 1099-S y los documentos de la compra original.",
              ])}
            </Note>
            <RowList
              ctx={ctx}
              path={p("improvements")}
              items={improvements}
              max={MAX_IMPROVEMENTS}
              addLabel={t(["Add an item", "Agregar un artículo"])}
              onAdd={() => set("improvements")([...improvements, { key: newKey(), property: "", description: "", date: "", cost: "", type: "" }])}
              onRemove={(i) => set("improvements")(improvements.filter((_, j) => j !== i))}
              title={(i) => `${t(["Item", "Artículo"])} ${i + 1}`}
              render={(row, i) => (
                <div className="grid gap-4 sm:grid-cols-4">
                  <Select
                    ctx={ctx}
                    path={p("improvements", i, "property")}
                    label={t(["Property", "Propiedad"])}
                    value={str(row, ["property"])}
                    onChange={set("improvements", i, "property")}
                    options={PROPERTY_LETTERS.slice(0, Math.max(1, properties.length)).map((l) => ({ value: l, label: l }))}
                  />
                  <Field ctx={ctx} className="sm:col-span-3" path={p("improvements", i, "description")} label={t(["Description", "Descripción"])} value={str(row, ["description"])} onChange={set("improvements", i, "description")} required maxLength={160} />
                  <Field ctx={ctx} path={p("improvements", i, "date")} kind="date" label={t(["Date", "Fecha"])} value={str(row, ["date"])} onChange={set("improvements", i, "date")} />
                  <Field ctx={ctx} path={p("improvements", i, "cost")} kind="money" label={t(["Cost or sale price", "Costo o precio de venta"])} value={str(row, ["cost"])} onChange={set("improvements", i, "cost")} />
                  <Field ctx={ctx} className="sm:col-span-2" path={p("improvements", i, "type")} label={t(["Type", "Tipo"])} value={str(row, ["type"])} onChange={set("improvements", i, "type")} maxLength={60} />
                </div>
              )}
            />
          </>
        ) : null}
      </Part>

      {showK1s ? (
        <Part letter="F" title={t(["Partnerships, S corporations, estates and trusts (K-1)", "Sociedades, corporaciones S, sucesiones y fideicomisos (K-1)"])}>
          <RowList
            ctx={ctx}
            path={p("k1s")}
            items={k1s}
            max={MAX_K1S}
            addLabel={t(["Add a K-1", "Agregar un K-1"])}
            onAdd={() => set("k1s")([...k1s, { key: newKey(), entity: "", ein: "", type: "", received: "", materially: "", basis: "" }])}
            onRemove={(i) => set("k1s")(k1s.filter((_, j) => j !== i))}
            title={(i) => `K-1 ${i + 1}`}
            render={(row, i) => (
              <div className="space-y-3">
                <div className="grid gap-4 sm:grid-cols-4">
                  <Field ctx={ctx} className="sm:col-span-2" path={p("k1s", i, "entity")} label={t(["Entity name", "Nombre de la entidad"])} value={str(row, ["entity"])} onChange={set("k1s", i, "entity")} required />
                  <Field ctx={ctx} path={p("k1s", i, "ein")} label="EIN" value={str(row, ["ein"])} onChange={set("k1s", i, "ein")} maxLength={10} />
                  <Field ctx={ctx} path={p("k1s", i, "type")} label={t(["Type", "Tipo"])} value={str(row, ["type"])} onChange={set("k1s", i, "type")} maxLength={40} />
                  <Field ctx={ctx} className="sm:col-span-2" path={p("k1s", i, "basis")} kind="money" label={t(["Money invested or loaned (basis)", "Dinero invertido o prestado (base)"])} value={str(row, ["basis"])} onChange={set("k1s", i, "basis")} />
                </div>
                <YesNo ctx={ctx} path={p("k1s", i, "received")} label={t(["K-1 received?", "¿K-1 recibido?"])} value={str(row, ["received"])} onChange={set("k1s", i, "received")} />
                <YesNo ctx={ctx} path={p("k1s", i, "materially")} label={t(["Materially participate?", "¿Participa materialmente?"])} value={str(row, ["materially"])} onChange={set("k1s", i, "materially")} />
              </div>
            )}
          />
        </Part>
      ) : null}

      <YesNo
        ctx={ctx}
        path={p("priorLosses")}
        label={t(["Losses from a prior year not allowed (at-risk, basis or passive limits — Form 8582)?", "¿Pérdidas de un año anterior no permitidas (límites de riesgo, base o actividad pasiva — Formulario 8582)?"])}
        value={v("priorLosses")}
        onChange={set("priorLosses")}
      />

      <Part letter="G" title={t(["Due-diligence questions", "Preguntas de debida diligencia"])} note={t(["You can answer now or during the interview", "Puede responder ahora o en la entrevista"])}>
        {E_DUE_DILIGENCE.map(([k, en, es]) => (
          <Area key={k} ctx={ctx} path={p("dueDiligence", k)} label={t(fill([en, es], { year }))} value={v("dueDiligence", k)} onChange={set("dueDiligence", k)} />
        ))}
      </Part>
    </div>
  );
}
