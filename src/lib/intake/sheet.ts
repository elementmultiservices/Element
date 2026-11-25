/**
 * Bilingual texts of the paper Client Intake Sheet and its Schedule C and
 * Schedule E sheets. The PDF prints both languages ("English / Español");
 * the online form and the on-screen summary pick one with `pick`.
 */
export type Bi = readonly [en: string, es: string];

export const pick = (b: Bi, locale: string): string => (locale === "es" ? b[1] : b[0]);
/** Fills {year}-style placeholders in both languages. */
export const fill = (b: Bi, values: Record<string, string | number>): Bi =>
  b.map((s) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ""))) as unknown as Bi;

export const YES: Bi = ["Yes", "Sí"];
export const NO: Bi = ["No", "No"];

// ------------------------------------------------------------ choices
export const MARITAL_STATUSES = ["single", "married", "divorced", "widowed"] as const;
export const MARITAL_LABELS: Record<(typeof MARITAL_STATUSES)[number], Bi> = {
  single: ["Single", "Soltero(a)"],
  married: ["Married", "Casado(a)"],
  divorced: ["Divorced or legally separated", "Divorciado(a) o separado(a) legalmente"],
  widowed: ["Widowed", "Viudo(a)"],
};

export const HOUSING = ["rent", "own", "other"] as const;
export const HOUSING_LABELS: Record<(typeof HOUSING)[number], Bi> = {
  rent: ["Rent", "Renta"],
  own: ["Own", "Dueño(a)"],
  other: ["Other", "Otro"],
};

export const CLAIMABLE = ["no", "yes", "unsure"] as const;
export const CLAIMABLE_LABELS: Record<(typeof CLAIMABLE)[number], Bi> = {
  no: ["No", "No"],
  yes: ["Yes", "Sí"],
  unsure: ["Not sure", "No estoy seguro(a)"],
};

export const RELATIONSHIP_LABELS: Record<string, Bi> = {
  son: ["Son", "Hijo"],
  daughter: ["Daughter", "Hija"],
  stepchild: ["Stepchild", "Hijastro(a)"],
  fosterChild: ["Foster child", "Hijo(a) de crianza"],
  sibling: ["Brother or sister", "Hermano(a)"],
  parent: ["Parent", "Padre o madre"],
  grandchild: ["Grandchild", "Nieto(a)"],
  other: ["Other relative", "Otro pariente"],
};

/** Income choices, in the order of the paper sheet (section D). */
export const INCOME_LABELS: Record<string, Bi> = {
  w2: ["W-2 wages", "Salarios W-2"],
  selfEmployment: ["Cash or self-employment income", "Ingresos en efectivo o por cuenta propia"],
  necMisc: ["Form 1099-NEC / 1099-MISC", "Formulario 1099-NEC / 1099-MISC"],
  paymentApps: ["Form 1099-K (apps, cards, marketplaces)", "Formulario 1099-K (aplicaciones, tarjetas, plataformas)"],
  unemployment: ["Form 1099-G — unemployment or state refund", "Formulario 1099-G — desempleo o reembolso estatal"],
  interestDividends: ["Form 1099-INT / 1099-DIV — interest or dividends", "Formulario 1099-INT / 1099-DIV — intereses o dividendos"],
  retirement: ["Form 1099-R retirement · SSA-1099 Social Security", "Formulario 1099-R jubilación · SSA-1099 Seguro Social"],
  rental: ["Rental property income", "Ingresos por alquiler de propiedades"],
  royalties: ["Royalties (Form 1099-MISC box 2)", "Regalías (Formulario 1099-MISC casilla 2)"],
  k1: ["Schedule K-1 (partnership, S corporation, estate or trust)", "Anexo K-1 (sociedad, corporación S, sucesión o fideicomiso)"],
  gambling: ["Gambling winnings (Form W-2G)", "Ganancias de juegos de azar (Formulario W-2G)"],
  alimony: ["Alimony received", "Pensión alimenticia recibida"],
  foreign: ["Any income from outside the U.S.", "Algún ingreso de fuera de EE. UU."],
  cryptoStocks: ["Sale of stocks or crypto (Form 1099-B)", "Venta de acciones o criptomonedas (Formulario 1099-B)"],
  other: ["Other income", "Otro ingreso"],
  // Older forms only.
  socialSecurity: ["Social Security (SSA-1099)", "Seguro Social (SSA-1099)"],
};

/** Life events and expenses (section E). */
export const DEDUCTION_LABELS: Record<string, Bi> = {
  childcare: ["Paid childcare", "Pagó cuidado infantil"],
  tuition: ["College tuition (1098-T) · student loan interest (1098-E)", "Matrícula universitaria (1098-T) · intereses de préstamo estudiantil (1098-E)"],
  marketplace: ["Health insurance through the Marketplace (Form 1095-A)", "Seguro de salud del Mercado (Formulario 1095-A)"],
  home: ["Bought or sold a home · mortgage interest (1098) · property tax", "Compró o vendió casa · intereses hipotecarios (1098) · impuesto a la propiedad"],
  estimatedPayments: ["Estimated tax payments made", "Pagos de impuesto estimado"],
  retirementContrib: ["IRA or retirement contributions", "Aportes a IRA o plan de jubilación"],
  teacher: ["Teacher: classroom expenses", "Maestro(a): gastos del aula"],
  carLoan: ["Interest on a loan for a new car bought after 2024", "Intereses de préstamo por un auto nuevo comprado después de 2024"],
  charity: ["Charitable gifts (receipts)", "Donaciones caritativas (recibos)"],
  // Older forms only.
  mortgage: ["Mortgage interest (1098)", "Intereses hipotecarios (1098)"],
  propertyTax: ["Property tax", "Impuesto a la propiedad"],
  studentLoan: ["Student loan interest (1098-E)", "Intereses de préstamo estudiantil (1098-E)"],
};

// ------------------------------------------------------- main sheet
export const MAIN = {
  usCitizen: ["U.S. citizen or resident all year?", "¿Ciudadano o residente de EE. UU. todo el año?"],
  maritalStatus: ["Marital status on December 31, {year}", "Estado civil al 31 de diciembre de {year}"],
  spouseDeathYear: ["Year your spouse died", "Año en que falleció su cónyuge"],
  county: ["County / school district (PA)", "Condado / distrito escolar (PA)"],
  multiState: ["Did you live or work in more than one state in {year}?", "¿Vivió o trabajó en más de un estado en {year}?"],
  statesDetail: ["States lived or worked in during {year} (with dates)", "Estados donde vivió o trabajó en {year} (con fechas)"],
  housing: ["Rent or own your home?", "¿Renta o es dueño de su vivienda?"],
  student: ["Full-time student?", "¿Estudiante de tiempo completo?"],
  disabled: ["Permanently disabled?", "¿Discapacidad permanente?"],
  claimable: ["Could anyone else claim this person?", "¿Alguien más podría reclamar a esta persona?"],
  w2Employers: ["How many employers?", "¿Cuántos empleadores?"],
  tipsOvertime: ["Tips or overtime shown on the W-2?", "¿Propinas u horas extra en el W-2?"],
  describeWork: ["Describe the work", "Describa el trabajo"],
  keepsRecords: ["Do you keep records?", "¿Guarda registros?"],
  necIsBusiness: [
    "Is this income from work you do on your own or a business you run?",
    "¿Este ingreso viene de un trabajo por su cuenta o de un negocio suyo?",
  ],
  kIsBusiness: [
    "Is it from a business or self-employment (not from selling your own personal items)?",
    "¿Es de un negocio o trabajo por cuenta propia (no de vender sus artículos personales)?",
  ],
  otherIncome: ["Describe", "Describa"],
  childcareProvider: ["Provider name", "Nombre del proveedor"],
  childcareEin: ["EIN / SSN", "EIN / SSN"],
  childcareAmount: ["Amount paid", "Monto pagado"],
  estimatedDetails: ["Dates and amounts", "Fechas y montos"],
  dd1: [
    "1. Did you pay more than half the cost of keeping up your home in {year}? Who else lived there and did they pay rent or expenses?",
    "1. ¿Pagó más de la mitad del costo de mantener su hogar en {year}? ¿Quién más vivió allí y pagó renta o gastos?",
  ],
  dd2: [
    "2. For each child: where did the child live during {year}, with whom, and for how many months? Is there another parent or relative who could claim the child?",
    "2. Por cada hijo: ¿dónde vivió el niño en {year}, con quién y cuántos meses? ¿Hay otro padre, madre o pariente que podría reclamarlo?",
  ],
  dd3: [
    "3. Were the EITC, CTC/ACTC/ODC or AOTC ever disallowed or reduced on a prior return?",
    "3. ¿Alguna vez le negaron o redujeron el EITC, CTC/ACTC/ODC o AOTC en una declaración anterior?",
  ],
  ddYear: ["Year", "Año"],
  ddIntro: ["You can answer now or during the interview", "Puede responder ahora o en la entrevista"],
  priorReturn: ["Prior-year return available?", "¿Tiene la declaración del año anterior?"],
  otherStateLastYear: ["Filed in another state or country last year?", "¿Presentó en otro estado o país el año pasado?"],
  authorizedPerson: ["Person authorized to discuss my return (optional)", "Persona autorizada para hablar de mi declaración (opcional)"],
} as const satisfies Record<string, Bi>;

// ----------------------------------------------------- Schedule C
export const OWNERS_C = ["taxpayer", "spouse"] as const;
export const OWNERS_E = ["taxpayer", "spouse", "both"] as const;
export const OWNER_LABELS: Record<string, Bi> = {
  taxpayer: ["Taxpayer", "Contribuyente"],
  spouse: ["Spouse", "Cónyuge"],
  both: ["Both", "Ambos"],
};

export const ACCOUNTING_METHODS = ["cash", "accrual", "other"] as const;
export const ACCOUNTING_LABELS: Record<(typeof ACCOUNTING_METHODS)[number], Bi> = {
  cash: ["Cash", "Efectivo"],
  accrual: ["Accrual", "Devengado"],
  other: ["Other", "Otro"],
};

export const INCOME_RECORDS = ["receiptBook", "invoices", "bankDeposits", "appReports"] as const;
export const INCOME_RECORD_LABELS: Record<(typeof INCOME_RECORDS)[number], Bi> = {
  receiptBook: ["Receipt book", "Talonario"],
  invoices: ["Invoices", "Facturas"],
  bankDeposits: ["Bank deposits", "Depósitos"],
  appReports: ["App reports", "Reportes de la app"],
};

export const MILEAGE_LOGS = ["app", "notebook", "calendar", "none"] as const;
export const MILEAGE_LOG_LABELS: Record<(typeof MILEAGE_LOGS)[number], Bi> = {
  app: ["App", "App"],
  notebook: ["Notebook", "Libreta"],
  calendar: ["Calendar", "Calendario"],
  none: ["None", "Ninguna"],
};

export const VEHICLE_METHODS = ["standard", "actual"] as const;
export const VEHICLE_METHOD_LABELS: Record<(typeof VEHICLE_METHODS)[number], Bi> = {
  standard: [
    "Standard mileage (covers gas, repairs, insurance, depreciation)",
    "Millaje estándar (cubre gasolina, reparaciones, seguro, depreciación)",
  ],
  actual: ["Actual expenses", "Gastos reales"],
};

export const HOME_OFFICE_METHODS = ["simplified", "actual"] as const;
export const HOME_OFFICE_METHOD_LABELS: Record<(typeof HOME_OFFICE_METHODS)[number], Bi> = {
  simplified: ["Simplified method", "Método simplificado"],
  actual: ["Actual expenses (Form 8829)", "Gastos reales (Formulario 8829)"],
};

export const ASSET_STATUSES = ["new", "used", "sold"] as const;
export const ASSET_STATUS_LABELS: Record<(typeof ASSET_STATUSES)[number], Bi> = {
  new: ["New", "Nuevo"],
  used: ["Used", "Usado"],
  sold: ["Sold", "Vendido"],
};

/** Yes/no questions of Schedule C part A, in order. */
export const C_FLAGS = [
  ["materially", "G · Did you materially participate in the business in {year}?", "G · ¿Participó materialmente en el negocio en {year}?"],
  ["startedThisYear", "H · Did you start or acquire this business during {year}?", "H · ¿Empezó o adquirió este negocio en {year}?"],
  [
    "paid1099",
    "I · Paid any person (not an employee) $2,000 or more for services in {year}? (Form 1099-NEC)",
    "I · ¿Pagó a alguna persona (no empleado) $2,000 o más por servicios en {year}? (Formulario 1099-NEC)",
  ],
  ["filed1099", "J · Were the Forms 1099 filed (or will they be)?", "J · ¿Presentó (o presentará) los Formularios 1099?"],
  ["employees", "Employees on payroll (Forms W-2, 941)?", "¿Empleados en nómina (Formularios W-2, 941)?"],
  ["inventory", "Sells products / keeps inventory?", "¿Vende productos / tiene inventario?"],
  ["vehicle", "Uses a vehicle for the business?", "¿Usa un vehículo para el negocio?"],
  ["homeOffice", "Uses part of the home regularly and exclusively for the business?", "¿Usa parte de la casa regular y exclusivamente para el negocio?"],
  [
    "equipment",
    "Bought equipment or tools over $2,500 each, or sold business assets?",
    "¿Compró equipo o herramientas de más de $2,500 cada uno, o vendió activos del negocio?",
  ],
] as const;
export type CFlag = (typeof C_FLAGS)[number][0];

/** Schedule C part II expense lines: [key, line, English, Spanish]. */
export const C_EXPENSES = [
  ["advertising", "8", "Advertising", "Publicidad"],
  ["commissions", "10", "Commissions and fees", "Comisiones y cuotas"],
  ["contractLabor", "11", "Contract labor (helpers — 1099-NEC)", "Mano de obra contratada (ayudantes — 1099-NEC)"],
  ["benefits", "14", "Employee benefit programs", "Programas de beneficios para empleados"],
  ["insurance", "15", "Insurance (other than health)", "Seguro (que no sea de salud)"],
  ["mortgageInterest", "16a", "Mortgage interest (business property)", "Intereses hipotecarios (propiedad del negocio)"],
  ["vehicleInterest", "16b", "Vehicle loan interest (business %)", "Intereses del préstamo del vehículo (% de negocio)"],
  ["otherInterest", "16c", "Other business interest", "Otros intereses del negocio"],
  ["legal", "17", "Legal and professional services", "Servicios legales y profesionales"],
  ["office", "18", "Office expense", "Gastos de oficina"],
  ["pension", "19", "Pension plans (employees)", "Planes de pensión (empleados)"],
  ["rentVehicles", "20a", "Rent — vehicles, machinery, equipment", "Renta — vehículos, maquinaria, equipo"],
  ["rentProperty", "20b", "Rent — shop, booth, chair, storage", "Renta — local, puesto, silla, bodega"],
  ["repairs", "21", "Repairs and maintenance", "Reparaciones y mantenimiento"],
  ["supplies", "22", "Supplies (used up in the work)", "Suministros (que se consumen en el trabajo)"],
  ["taxes", "23", "Taxes and licenses (business license, payroll taxes)", "Impuestos y licencias (licencia comercial, impuestos de nómina)"],
  ["travel", "24a", "Travel (away from home overnight)", "Viajes (fuera de casa con pernocta)"],
  ["meals", "24b", "Meals with clients / while traveling (50 %)", "Comidas con clientes / en viaje (50 %)"],
  ["utilities", "25", "Utilities (phone, internet)", "Servicios públicos (teléfono, internet)"],
  ["wages", "26", "Wages paid to employees (W-2)", "Salarios pagados a empleados (W-2)"],
  ["smallTools", "27b", "Small tools / equipment under $2,500 each", "Herramientas / equipo de menos de $2,500 cada uno"],
  ["software", "27b", "Software, subscriptions, bank / card fees", "Software, suscripciones, comisiones bancarias / de tarjeta"],
  ["uniforms", "27b", "Uniforms / safety gear · training · dues", "Uniformes / equipo de seguridad · capacitación · cuotas"],
  ["otherExpenses", "27b", "Other expenses (list below)", "Otros gastos (liste abajo)"],
] as const;
export type CExpense = (typeof C_EXPENSES)[number][0];

/** Vehicle actual-expense amounts: [key, English, Spanish]. */
export const VEHICLE_COSTS = [
  ["gas", "Gas / oil", "Gasolina / aceite"],
  ["repairs", "Repairs", "Reparaciones"],
  ["insurance", "Insurance", "Seguro"],
  ["registration", "Registration", "Registro"],
  ["lease", "Lease", "Arrendamiento"],
  ["loanInterest", "Loan interest (16b)", "Intereses del préstamo (16b)"],
] as const;

/** Cost of goods sold lines: [key, line, English, Spanish]. */
export const COGS_LINES = [
  ["beginning", "35", "Inventory at beginning of year", "Inventario al inicio del año"],
  ["purchases", "36", "Purchases, less items taken for personal use", "Compras, menos artículos para uso personal"],
  ["labor", "37", "Cost of labor (not yourself)", "Costo de mano de obra (no usted)"],
  ["materials", "38", "Materials and supplies", "Materiales y suministros"],
  ["ending", "41", "Inventory at end of year", "Inventario al final del año"],
] as const;

/** Section I amounts, shared by all businesses: [key, English, Spanish]. */
export const C_SHARED = [
  [
    "healthPremiums",
    "Health insurance premiums paid for yourself / family — not through an employer plan (Form 7206)",
    "Primas de seguro de salud pagadas para usted / su familia — no por un plan de empleador (Formulario 7206)",
  ],
  ["retirementPlan", "SEP, SIMPLE or solo 401(k) contributions", "Aportes a SEP, SIMPLE o 401(k) individual"],
  ["overpayment", "{prev} overpayment applied to {year}", "Pago en exceso de {prev} aplicado a {year}"],
  ["licenses", "State and local business licenses / taxes paid", "Licencias / impuestos estatales y locales del negocio pagados"],
] as const;

export const C_DUE_DILIGENCE = [
  [
    "income",
    "1. How is the income recorded (receipt book, invoices, app, deposits)? Does the total agree with the bank deposits?",
    "1. ¿Cómo se registran los ingresos (talonario, facturas, aplicación, depósitos)? ¿El total concuerda con los depósitos del banco?",
  ],
  [
    "expenses",
    "2. Which expenses have receipts and which are estimates? How was the business share of the phone, vehicle or home measured?",
    "2. ¿Qué gastos tienen recibos y cuáles son estimados? ¿Cómo se midió la parte de negocio del teléfono, el vehículo o la casa?",
  ],
  [
    "helpers",
    "3. Who was paid to help (names, how, how much)? Were Forms 1099-NEC issued, and are the helpers employees?",
    "3. ¿A quién le pagó por ayudar (nombres, cómo, cuánto)? ¿Se emitieron Formularios 1099-NEC, y son empleados?",
  ],
  [
    "profit",
    "4. Is this a business run for profit (regular work, records, customers, licenses) or a hobby? Profit or loss in prior years?",
    "4. ¿Es un negocio con fines de lucro (trabajo regular, registros, clientes, licencias) o un pasatiempo? ¿Ganancia o pérdida en años anteriores?",
  ],
] as const;

// ----------------------------------------------------- Schedule E
export const MAX_PROPERTIES = 3;
export const MAX_BUSINESSES = 5;
export const PROPERTY_LETTERS = ["A", "B", "C"] as const;

export const PROPERTY_TYPES = ["1", "2", "3", "4", "5", "6", "7", "8"] as const;
export const PROPERTY_TYPE_LABELS: Record<(typeof PROPERTY_TYPES)[number], Bi> = {
  "1": ["1 Single family residence", "1 Residencia unifamiliar"],
  "2": ["2 Multi-family residence", "2 Multifamiliar"],
  "3": ["3 Vacation / short-term rental", "3 Vacacional / corto plazo"],
  "4": ["4 Commercial", "4 Comercial"],
  "5": ["5 Land", "5 Terreno"],
  "6": ["6 Royalties", "6 Regalías"],
  "7": ["7 Self-rental (rented to your own business)", "7 Rentada a su propio negocio"],
  "8": ["8 Other (describe)", "8 Otro (describa)"],
};

/** Yes/no questions of Schedule E part A: [key, English, Spanish]. */
export const E_FLAGS = [
  [
    "paid1099",
    "A · Paid anyone (not an employee) $2,000 or more for services in {year}? (Form 1099-NEC)",
    "A · ¿Pagó a alguien (no empleado) $2,000 o más por servicios en {year}? (Formulario 1099-NEC)",
  ],
  ["filed1099", "B · Were the Forms 1099 filed (or will they be)?", "B · ¿Presentó (o presentará) los Formularios 1099?"],
  [
    "active",
    "Do you decide on tenants, rent and repairs yourself (active participation)?",
    "¿Usted decide sobre inquilinos, renta y reparaciones (participación activa)?",
  ],
  [
    "reProfessional",
    "Real estate professional (over half of your work hours and 750+ hours in real estate)?",
    "¿Profesional de bienes raíces (más de la mitad de sus horas de trabajo y más de 750 horas)?",
  ],
  ["relative", "Rented to a relative or for less than market rent?", "¿Rentada a un pariente o por menos de la renta de mercado?"],
  [
    "shortTerm",
    "Short-term rentals (average stay 7 days or less) or services to guests?",
    "¿Alquiler a corto plazo (estadía promedio de 7 días o menos) o servicios a los huéspedes?",
  ],
  ["personalUse", "Personal use of any rental by you or your family in {year}?", "¿Uso personal de algún alquiler por usted o su familia en {year}?"],
] as const;
export type EFlag = (typeof E_FLAGS)[number][0];

/** Per-property text fields of part B: [key, English, Spanish, kind]. */
export const E_DETAILS = [
  ["address", "1a · Address (street, apt., city, state, ZIP)", "1a · Dirección (calle, apto., ciudad, estado, ZIP)", "text"],
  ["describe", "Describe", "Describa", "text"],
  ["bought", "Date bought", "Fecha de compra", "date"],
  ["firstRented", "Date first rented", "Fecha en que se rentó por primera vez", "date"],
  ["price", "Purchase price + closing costs", "Precio de compra + costos de cierre", "money"],
  ["land", "Land value", "Valor del terreno", "money"],
  ["rentalDays", "2 · Fair rental days in {year}", "2 · Días rentados en {year}", "days"],
  ["personalDays", "Personal use days", "Días de uso personal", "days"],
  ["monthsRented", "Months rented", "Meses rentados", "months"],
  ["monthsVacant", "Months vacant", "Meses vacíos", "months"],
  ["rentPerMonth", "Rent per month", "Renta mensual", "money"],
  ["lender", "Mortgage lender (Form 1098)", "Prestamista hipotecario (Formulario 1098)", "text"],
] as const;

/** Per-property yes/no fields of part B. */
export const E_PROPERTY_FLAGS = [
  ["taxBills", "Property tax bills available?", "¿Tiene las facturas del impuesto a la propiedad?"],
  ["management", "Management company?", "¿Administradora?"],
  ["tenantUtilities", "Tenant pays utilities?", "¿El inquilino paga los servicios?"],
  ["qjv", "Qualified joint venture (QJV)?", "¿Empresa conjunta calificada (QJV)?"],
] as const;

/** Per-property income (part C): [key, English, Spanish]. */
export const E_INCOME = [
  ["rents", "3 · Rents received (incl. advance rent and tenant-paid expenses)", "3 · Rentas recibidas (incl. renta por adelantado y gastos pagados por el inquilino)"],
  ["royalties", "4 · Royalties received (Form 1099-MISC box 2)", "4 · Regalías recibidas (Formulario 1099-MISC casilla 2)"],
  ["depositsKept", "Deposits kept in {year} (income)", "Depósitos retenidos en {year} (ingreso)"],
  ["depositsHeld", "Deposits held (not income)", "Depósitos en custodia (no es ingreso)"],
] as const;

/** Per-property expenses (part D): [key, English, Spanish]. */
export const E_EXPENSES = [
  ["advertising", "5 · Advertising", "5 · Publicidad"],
  ["auto", "6 · Auto and travel (trips to the property — keep a log)", "6 · Auto y viajes (viajes a la propiedad — bitácora)"],
  ["cleaning", "7 · Cleaning and maintenance", "7 · Limpieza y mantenimiento"],
  ["commissions", "8 · Commissions (leasing, agents)", "8 · Comisiones (arrendamiento, agentes)"],
  ["insurance", "9 · Insurance (landlord policy)", "9 · Seguro (póliza de arrendador)"],
  ["legal", "10 · Legal and other professional fees", "10 · Honorarios legales y profesionales"],
  ["management", "11 · Management fees", "11 · Cuotas de administración"],
  ["mortgage", "12 · Mortgage interest paid to banks (Form 1098)", "12 · Intereses hipotecarios pagados a bancos (Formulario 1098)"],
  ["vehicleInterest", "13a · Vehicle loan interest", "13a · Intereses del préstamo del vehículo"],
  ["otherInterest", "13b · Other interest (loans for the property)", "13b · Otros intereses (préstamos para la propiedad)"],
  ["repairs", "14 · Repairs (keep the property as it was)", "14 · Reparaciones (mantienen la propiedad como estaba)"],
  ["supplies", "15 · Supplies", "15 · Suministros"],
  ["taxes", "16 · Taxes (property tax; not income tax)", "16 · Impuestos (a la propiedad; no sobre la renta)"],
  ["utilities", "17 · Utilities paid by you (water, gas, electric, trash)", "17 · Servicios pagados por usted (agua, gas, luz, basura)"],
  ["other", "19 · Other: HOA dues, pest control, licenses, bank fees", "19 · Otros: asociación, control de plagas, licencias, comisiones bancarias"],
] as const;
export type EExpense = (typeof E_EXPENSES)[number][0];

export const E_DUE_DILIGENCE = [
  [
    "collection",
    "1. How is the rent collected and recorded (bank, app, cash)? Do the deposits agree with the rent ledger? Any month unpaid?",
    "1. ¿Cómo se cobra y registra la renta (banco, aplicación, efectivo)? ¿Los depósitos concuerdan con el libro de rentas? ¿Algún mes sin pagar?",
  ],
  [
    "occupants",
    "2. Who lived in each property in {year} — tenants, relatives, the owner? Any days of personal use or vacancy?",
    "2. ¿Quién vivió en cada propiedad en {year} — inquilinos, parientes, el dueño? ¿Días de uso personal o vacante?",
  ],
  [
    "receipts",
    "3. Which expenses have receipts? Which are repairs and which are improvements? Who was paid $2,000 or more?",
    "3. ¿Qué gastos tienen recibos? ¿Cuáles son reparaciones y cuáles mejoras? ¿A quién se le pagó $2,000 o más?",
  ],
  [
    "priorYear",
    "4. Last year's Schedule E and depreciation schedule available? Any suspended passive losses (Form 8582)?",
    "4. ¿Tiene el Anexo E y el cuadro de depreciación del año pasado? ¿Pérdidas pasivas suspendidas (Formulario 8582)?",
  ],
] as const;

/** Sum of the amounts given ("" when none was given). */
export function sumAmounts(values: string[]): string {
  const given = values.filter((v) => v !== "");
  if (given.length === 0) return "";
  const cents = given.reduce((total, v) => total + Math.round(Number(v) * 100), 0);
  return (cents / 100).toFixed(2);
}

/** "1234.5" → "$1,234.50" ("" stays ""). */
export function formatAmount(value: string): string {
  if (value === "") return "";
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
