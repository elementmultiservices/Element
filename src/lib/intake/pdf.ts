import "server-only";
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFImage, type PDFPage, type RGB } from "pdf-lib";
import { LOGO_SIZE, MARK_MIDDLE, MARK_OUTER, TAGLINE, WORD } from "@/components/brand/logo-paths";
import { maskTaxId, needsScheduleC, needsScheduleE, type IntakeBusiness, type IntakeData, type IntakeScheduleE } from "./schema";
import {
  ACCOUNTING_LABELS,
  ACCOUNTING_METHODS,
  ASSET_STATUS_LABELS,
  C_DUE_DILIGENCE,
  C_EXPENSES,
  C_FLAGS,
  C_SHARED,
  CLAIMABLE,
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
  HOME_OFFICE_METHODS,
  HOUSING,
  HOUSING_LABELS,
  INCOME_LABELS,
  INCOME_RECORD_LABELS,
  INCOME_RECORDS,
  MAIN,
  MARITAL_LABELS,
  MARITAL_STATUSES,
  MILEAGE_LOG_LABELS,
  MILEAGE_LOGS,
  NO,
  OWNER_LABELS,
  OWNERS_C,
  OWNERS_E,
  PROPERTY_LETTERS,
  PROPERTY_TYPE_LABELS,
  RELATIONSHIP_LABELS,
  sumAmounts,
  VEHICLE_COSTS,
  VEHICLE_METHOD_LABELS,
  VEHICLE_METHODS,
  YES,
  type Bi,
} from "./sheet";

/**
 * Builds the intake PDF in the layout of the paper Client Intake Sheet
 * (English / Spanish): the intake sheet, then the Schedule E sheet when the
 * client has rentals, royalties or K-1s, then one Schedule C sheet per
 * business when the client is self-employed. The service agreement, the list
 * of documents and every attached PDF and image follow, so the whole file can
 * be reviewed in one document. Office files are listed for separate download.
 */

const W = 612; // US Letter
const H = 792;
const M = 40;
const CW = W - M * 2;
const BOTTOM = 58;
const INK = rgb(0.07, 0.09, 0.2);
const ES = rgb(0.24, 0.42, 0.8);
const MUTED = rgb(0.42, 0.46, 0.55);
const BOX = rgb(0.56, 0.71, 0.96);
const RULE = rgb(0.84, 0.89, 0.97);
const FILL = rgb(0.94, 0.96, 1);
const BAR = rgb(0.25, 0.43, 0.86);
const CHECK = rgb(0.09, 0.3, 0.78);
// Official logo colors (see components/brand/wordmark.tsx).
const BRAND_DARK = rgb(0x16 / 255, 0x6b / 255, 0xdf / 255);
const BRAND_LIGHT = rgb(0x30 / 255, 0x9f / 255, 0xfd / 255);

export type PdfAttachment = {
  name: string;
  typeLabel: string;
  sizeLabel: string;
  mime: string;
  bytes: Uint8Array | null;
};

/** Texts of the parts that follow the sheets, in the language asked for. */
export type PdfLabels = {
  agreementTitle: string;
  confirmationsTitle: string;
  documentsTitle: string;
  documentsEmpty: string;
  documentsSeparate: string;
  signedBy: string;
  spouseSignedBy: string;
  signedAt: string;
  signerIp: string;
  attachmentHeading: string;
  attachmentFailed: string;
};

export type PdfSignature = { name: string; png: Uint8Array | null; method: string };

export type PdfInput = {
  businessName: string;
  data: IntakeData;
  /** Full tax IDs and bank numbers (staff copy); masked otherwise. */
  full: boolean;
  clientName: string;
  reference: string;
  labels: PdfLabels;
  agreement: { intro: string; clauses: { title: string; body: string }[]; confirmations: { label: string; checked: boolean }[] };
  attachments: PdfAttachment[];
  signature: PdfSignature;
  spouseSignature: PdfSignature | null;
  /** JPEG taken after signing; older forms have none. */
  facePhoto: Uint8Array | null;
  signedAt: string;
  signerIp: string | null;
};

type Seg = { text: string; color: RGB; font: PDFFont };
type Line = Seg[];
type Opt = { label: Bi; checked: boolean };
type Field = { label: Bi; value?: string; w?: number; lines?: number; options?: Opt[]; vertical?: boolean; spacer?: boolean };
type Cell = string | { options: Opt[] } | { label: Bi };
type Sheet = { title: Bi; footer: Bi; info: Line; right: string };

/** Standard fonts only cover WinAnsi (Latin-1 + a few symbols): anything else becomes "?". */
function encoder(font: PDFFont) {
  const cache = new Map<string, boolean>();
  return (value: string) =>
    Array.from(value.normalize("NFC").replace(/\t/g, " "))
      .map((ch) => {
        if (ch === "\n") return ch;
        let ok = cache.get(ch);
        if (ok === undefined) {
          try {
            font.encodeText(ch);
            ok = true;
          } catch {
            ok = false;
          }
          cache.set(ch, ok);
        }
        return ok ? ch : "?";
      })
      .join("");
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width) {
        line = candidate;
        continue;
      }
      if (line) out.push(line);
      // A single word wider than the column is split by characters.
      let chunk = "";
      for (const ch of word) {
        if (font.widthOfTextAtSize(chunk + ch, size) > width && chunk) {
          out.push(chunk);
          chunk = "";
        }
        chunk += ch;
      }
      line = chunk;
    }
    out.push(line);
  }
  return out;
}

/** "2026-03-01" → "03/01/2026". */
const usDate = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v.slice(5, 7)}/${v.slice(8, 10)}/${v.slice(0, 4)}` : v);
const opts = <K extends string>(keys: readonly K[], labels: Record<K, Bi>, value: string | readonly string[]): Opt[] =>
  keys.map((k) => ({ label: labels[k], checked: typeof value === "string" ? value === k : value.includes(k) }));
const yesNoOpts = (value: string): Opt[] => [
  { label: YES, checked: value === "yes" },
  { label: NO, checked: value === "no" },
];
const FILING_LABELS: Record<string, Bi> = {
  single: ["Single", "Soltero(a)"],
  mfj: ["Married filing jointly", "Casado(a), declaración conjunta"],
  mfs: ["Married filing separately", "Casado(a), declaración por separado"],
  hoh: ["Head of household", "Cabeza de familia"],
  qss: ["Qualifying surviving spouse", "Cónyuge sobreviviente que califica"],
  unsure: ["Not sure", "No está seguro(a)"],
};
/** "English / Español" as plain text ("" when missing). */
const biText = (b: Bi | undefined) => (!b ? "" : b[0] === b[1] ? b[0] : `${b[0]} / ${b[1]}`);
const REFERRAL_LABELS: Record<string, Bi> = {
  friend: ["Friend or family", "Amigo o familiar"],
  social: ["Social media", "Redes sociales"],
  walkIn: ["Walked by the office", "Pasó por la oficina"],
  google: ["Google", "Google"],
  previousClient: ["Previous client", "Cliente anterior"],
  other: ["Other", "Otro"],
};
const QUESTION_LABELS: Record<string, Bi> = {
  irsLetter: ["Letters from the IRS or the State this year?", "¿Cartas del IRS o del estado este año?"],
  movedState: ["Moved during the year?", "¿Se mudó durante el año?"],
  homeSale: ["Bought or sold a home?", "¿Compró o vendió casa?"],
  fullYearCoverage: ["Health insurance all year?", "¿Seguro de salud todo el año?"],
  foreignAccounts: ["Income or bank accounts outside the U.S.?", "¿Ingresos o cuentas fuera de EE. UU.?"],
};

export async function buildIntakePdf(input: PdfInput): Promise<Uint8Array> {
  const { data, full } = input;
  const L = input.labels;
  const year = data.taxYear;

  const doc = await PDFDocument.create();
  doc.setTitle(`Client Intake Sheet / Hoja de admisión del cliente — ${year} — ${input.clientName}`);
  doc.setAuthor(input.businessName);
  doc.setCreator(input.businessName);
  doc.setProducer(input.businessName);

  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const safe = encoder(regular);
  const width = (s: string, size: number, font = regular) => font.widthOfTextAtSize(s, size);

  const packagePages = new Map<PDFPage, Bi>();
  let page!: PDFPage;
  let y = 0;
  let sheet!: Sheet;
  // Content area; narrowed inside the dashed office-use boxes.
  let left = M;
  let cw = CW;

  // ------------------------------------------------------------ drawing
  const seg = (text: string, color = INK, font = regular): Seg => ({ text: safe(text), color, font });
  const drawLine = (line: Line, x: number, top: number, size: number) => {
    let cx = x;
    for (const s of line) {
      // Leading spaces become an offset: some viewers drop them at the start of a text run.
      const text = s.text.trimStart();
      cx += s.font.widthOfTextAtSize(s.text.slice(0, s.text.length - text.length), size);
      page.drawText(text, { x: cx, y: top - size, size, font: s.font, color: s.color });
      cx += s.font.widthOfTextAtSize(text, size);
    }
    return cx - x;
  };
  const drawLines = (lines: Line[], x: number, top: number, size: number, lh = size * 1.25) => {
    lines.forEach((line, i) => drawLine(line, x, top - i * lh, size));
    return lines.length * lh;
  };
  /** "English / Español" on one line when it fits, otherwise English lines then Spanish lines. */
  const biLines = (b: Bi, w: number, size: number, font = regular): Line[] => {
    const [en, es] = [safe(b[0]), safe(b[1])];
    if (en === es) return wrap(en, font, size, w).map((t) => [{ text: t, color: INK, font }]);
    if (width(`${en} / ${es}`, size, font) <= w) return [[{ text: en, color: INK, font }, { text: ` / ${es}`, color: ES, font }]];
    return stacked(b, w, size, font);
  };
  /** English lines, then Spanish lines (as in the paper's two-line labels). */
  const stacked = (b: Bi, w: number, size: number, font = regular): Line[] => {
    const [en, es] = [safe(b[0]), safe(b[1])];
    const lines: Line[] = wrap(en, font, size, w).map((t) => [{ text: t, color: INK, font }]);
    if (es !== en) lines.push(...wrap(es, regular, size, w).map((t) => [{ text: t, color: ES, font: regular }]));
    return lines;
  };
  const roundRect = (x: number, top: number, w: number, h: number, r: number, style: { border?: RGB; fill?: RGB; dash?: boolean }) => {
    const path = `M ${r} 0 H ${w - r} Q ${w} 0 ${w} ${r} V ${h - r} Q ${w} ${h} ${w - r} ${h} H ${r} Q 0 ${h} 0 ${h - r} V ${r} Q 0 0 ${r} 0 Z`;
    page.drawSvgPath(path, {
      x,
      y: top,
      color: style.fill,
      borderColor: style.border,
      borderWidth: style.border ? 0.7 : 0,
      borderDashArray: style.dash ? [3, 2] : undefined,
    });
  };
  const checkbox = (x: number, top: number, checked: boolean) => {
    roundRect(x, top, 8, 8, 1.8, { border: BOX, fill: rgb(1, 1, 1) });
    if (!checked) return;
    page.drawLine({ start: { x: x + 1.7, y: top - 4.2 }, end: { x: x + 3.5, y: top - 6.3 }, thickness: 1.3, color: CHECK });
    page.drawLine({ start: { x: x + 3.5, y: top - 6.3 }, end: { x: x + 6.8, y: top - 1.6 }, thickness: 1.3, color: CHECK });
  };
  /** Options side by side, wrapping onto new lines; returns the height used. */
  const optionsInline = (options: Opt[], x: number, top: number, w: number, size = 8) => {
    let cx = x;
    let row = 0;
    for (const o of options) {
      const label = biLines(o.label, w - 12, size)[0] ?? [];
      const text = label.map((s) => s.text).join("");
      const ow = 12 + width(text, size) + 14;
      if (cx > x && cx + ow > x + w) {
        cx = x;
        row += 1;
      }
      const t = top - row * 13;
      checkbox(cx, t - 0.5, o.checked);
      drawLine(label, cx + 12, t, size);
      cx += ow;
    }
    return (row + 1) * 13;
  };
  const optionsVertical = (options: Opt[], x: number, top: number, w: number, size = 8) => {
    let t = top;
    for (const o of options) {
      checkbox(x, t - 0.5, o.checked);
      const lines = biLines(o.label, w - 12, size);
      drawLines(lines, x + 12, t, size, size * 1.22);
      t -= Math.max(lines.length * size * 1.22, 10) + 3;
    }
    return top - t;
  };

  // ------------------------------------------------------------- pages
  const header = () => {
    const scale = 1.05;
    const logo = { x: M, y: H - 34, scale };
    page.drawSvgPath(MARK_OUTER, { ...logo, color: BRAND_DARK });
    page.drawSvgPath(MARK_MIDDLE, { ...logo, color: BRAND_LIGHT });
    page.drawSvgPath(TAGLINE, { ...logo, color: BRAND_LIGHT });
    page.drawSvgPath(WORD, { ...logo, color: INK });
    const room = CW - LOGO_SIZE.width * scale - 20;
    const title = safe(sheet.title[0]);
    let size = 13;
    while (size > 9 && width(title, size, bold) > room) size -= 0.5;
    page.drawText(title, { x: W - M - width(title, size, bold), y: H - 50, size, font: bold, color: INK });
    const es = safe(sheet.title[1]);
    page.drawText(es, { x: W - M - width(es, 8.5), y: H - 63, size: 8.5, font: regular, color: ES });
    page.drawLine({ start: { x: M, y: H - 80 }, end: { x: W - M, y: H - 80 }, thickness: 0.6, color: RULE });
    page.drawLine({ start: { x: M, y: H - 80 }, end: { x: M + 60, y: H - 80 }, thickness: 2.2, color: BAR });
    drawLine(sheet.info, M, H - 92, 7.5);
    const right = safe(sheet.right);
    page.drawText(right, { x: W - M - width(right, 7.5), y: H - 99.5, size: 7.5, font: regular, color: INK });
    y = H - 116;
  };
  const newPage = () => {
    page = doc.addPage([W, H]);
    packagePages.set(page, sheet.footer);
    header();
  };
  const startSheet = (s: Sheet) => {
    sheet = s;
    newPage();
  };
  const ensure = (h: number) => {
    if (y - h < BOTTOM) newPage();
  };

  // ------------------------------------------------------------ blocks
  const callout = (texts: Bi[], size = 8) => {
    const lines = texts.flatMap((b) => stacked(b, cw - 30, size));
    const h = lines.length * size * 1.3 + 14;
    ensure(h + 8);
    roundRect(left, y, cw, h, 5, { fill: FILL });
    page.drawRectangle({ x: left, y: y - h, width: 3, height: h, color: BAR });
    drawLines(lines, left + 18, y - 7, size, size * 1.3);
    y -= h + 10;
  };

  const section = (letter: string, b: Bi) => {
    ensure(46);
    y -= 8;
    const size = 8.5;
    let x = left;
    if (letter) {
      page.drawText(letter, { x, y: y - size, size, font: bold, color: BAR });
      x += 14;
    }
    const en = safe(b[0].toUpperCase());
    const es = safe(b[1].toUpperCase());
    const one = width(`${en} / ${es}`, size, bold) <= left + cw - x - 30;
    let end = x + width(en, size, bold);
    page.drawText(en, { x, y: y - size, size, font: bold, color: INK });
    if (one) {
      page.drawText(` / ${es}`, { x: end, y: y - size, size, font: bold, color: ES });
      end += width(` / ${es}`, size, bold);
      page.drawLine({ start: { x: end + 8, y: y - size / 2 }, end: { x: left + cw, y: y - size / 2 }, thickness: 0.6, color: RULE });
      y -= size + 9;
    } else {
      page.drawText(es, { x, y: y - size * 2.3, size, font: bold, color: ES });
      end = x + width(es, size, bold);
      page.drawLine({ start: { x: end + 8, y: y - size * 1.8 }, end: { x: left + cw, y: y - size * 1.8 }, thickness: 0.6, color: RULE });
      y -= size * 2.3 + 9;
    }
  };

  const note = (b: Bi, size = 7.5) => {
    const lines = biLines(b, cw, size);
    ensure(lines.length * 10 + 4);
    y -= drawLines(lines, left, y, size, 10) + 4;
  };

  const sub = (b: Bi) => {
    const lines = biLines(b, cw - 10, 8.5);
    ensure(lines.length * 11 + 40);
    y -= 2;
    page.drawRectangle({ x: left, y: y - lines.length * 11 + 1, width: 2.5, height: lines.length * 11 - 2, color: BAR });
    y -= drawLines(lines, left + 8, y, 8.5, 11) + 5;
  };

  /** Labeled boxes side by side (a row of the paper form). */
  const fieldRow = (fields: Field[], gap = 12) => {
    const total = fields.reduce((s, f) => s + (f.w ?? 1), 0);
    const avail = cw - gap * (fields.length - 1);
    const cols = fields.map((f) => {
      const w = (avail * (f.w ?? 1)) / total;
      const label = f.spacer ? [] : biLines(f.label, w, 7.5);
      const value = f.spacer || f.options ? [] : wrap(safe(f.value ?? ""), regular, 9, w - 12);
      const body = f.options
        ? f.vertical
          ? f.options.reduce((s, o) => s + Math.max(biLines(o.label, w - 12, 8).length * 9.8, 10) + 3, 0)
          : 13 * Math.ceil(f.options.length / Math.max(1, Math.floor(w / 110)))
        : Math.max(19, Math.max(value.length, f.lines ?? 1) * 11.5 + 8);
      return { f, w, label, value, body };
    });
    const labelH = Math.max(...cols.map((c) => c.label.length)) * 9.4;
    const bodyH = Math.max(...cols.map((c) => c.body));
    ensure(labelH + bodyH + 12);
    let x = left;
    for (const c of cols) {
      if (!c.f.spacer) {
        drawLines(c.label, x, y - (labelH - c.label.length * 9.4), 7.5, 9.4);
        const top = y - labelH - 3;
        if (c.f.options) {
          if (c.f.vertical) optionsVertical(c.f.options, x, top - 2, c.w);
          else optionsInline(c.f.options, x, top - 3, c.w);
        } else {
          roundRect(x, top, c.w, c.body, 4, { border: BOX });
          c.value.forEach((line, i) => page.drawText(line, { x: x + 6, y: top - 13 - i * 11.5, size: 9, font: regular, color: INK }));
        }
      }
      x += c.w + gap;
    }
    y -= labelH + 3 + bodyH + 9;
  };

  /** A full-width text box that flows across pages when the answer is long. */
  const textArea = (label: Bi, value: string, minLines = 3) => {
    const labelLines = biLines(label, cw, 7.5);
    const lines = wrap(safe(value), regular, 9, cw - 12);
    if (lines.length * 11.5 + 8 + labelLines.length * 9.4 < y - BOTTOM - 20 || lines.length < 30) {
      fieldRow([{ label, value, lines: minLines }]);
      return;
    }
    ensure(labelLines.length * 9.4 + 60);
    y -= drawLines(labelLines, left, y, 7.5, 9.4) + 3;
    let rest = lines;
    while (rest.length > 0) {
      const fit = Math.floor((y - BOTTOM - 16) / 11.5);
      if (fit < 3) {
        newPage();
        continue;
      }
      const chunk = rest.slice(0, fit);
      rest = rest.slice(fit);
      const h = chunk.length * 11.5 + 8;
      roundRect(left, y, cw, h, 4, { border: BOX });
      chunk.forEach((line, i) => page.drawText(line, { x: left + 6, y: y - 13 - i * 11.5, size: 9, font: regular, color: INK }));
      y -= h + 9;
      if (rest.length > 0) newPage();
    }
  };

  /** A question with Yes / No boxes on the right. */
  const yesNo = (label: Bi, value: string, options: Opt[] = yesNoOpts(value)) => {
    const optW = 118;
    const lines = biLines(label, cw - optW - 10, 8);
    const h = Math.max(lines.length * 10, 10) + 9;
    ensure(h + 2);
    drawLines(lines, left, y - 4, 8, 10);
    const mid = y - 4 - (lines.length * 10 - 10) / 2;
    let x = left + cw - optW + 12;
    for (const o of options) {
      checkbox(x, mid - 0.5, o.checked);
      const label = biLines(o.label, 80, 8)[0] ?? [];
      x += 12 + drawLine(label, x + 12, mid, 8) + 14;
    }
    page.drawLine({ start: { x: left, y: y - h }, end: { x: left + cw, y: y - h }, thickness: 0.5, color: RULE });
    y -= h + 2;
  };

  /** A label above a row of options. */
  const choices = (label: Bi | null, options: Opt[]) => {
    const lines = label ? biLines(label, cw, 7.5) : [];
    const rows = (() => {
      let cx = 0;
      let r = 1;
      for (const o of options) {
        const text = (biLines(o.label, cw - 12, 8)[0] ?? []).map((s) => s.text).join("");
        const ow = 12 + width(text, 8) + 14;
        if (cx > 0 && cx + ow > cw) {
          cx = 0;
          r += 1;
        }
        cx += ow;
      }
      return r;
    })();
    ensure(lines.length * 9.4 + rows * 13 + 10);
    y -= drawLines(lines, left, y, 7.5, 9.4) + 3;
    y -= optionsInline(options, left, y, cw) + 6;
  };

  /** Checkboxes with two-line labels in columns (income, life events, documents). */
  const checkGrid = (items: Opt[], cols = 2) => {
    const gap = 18;
    const colW = (cw - gap * (cols - 1)) / cols;
    for (let i = 0; i < items.length; i += cols) {
      const row = items.slice(i, i + cols).map((o) => ({ o, lines: stacked(o.label, colW - 14, 7.8) }));
      const h = Math.max(...row.map((r) => r.lines.length)) * 9.6 + 7;
      ensure(h);
      row.forEach((r, j) => {
        const x = left + j * (colW + gap);
        checkbox(x, y - 0.5, r.o.checked);
        drawLines(r.lines, x + 14, y, 7.8, 9.6);
      });
      y -= h;
    }
    y -= 4;
  };

  const table = (columns: { label: Bi; w: number }[], rows: Cell[][], minRowH = 20) => {
    const total = columns.reduce((s, c) => s + c.w, 0);
    const widths = columns.map((c) => (cw * c.w) / total);
    const heads = columns.map((c, i) => stacked(c.label, widths[i]! - 8, 7));
    const headH = Math.max(...heads.map((h) => h.length)) * 8.6 + 9;
    const drawHead = () => {
      page.drawRectangle({ x: left, y: y - headH, width: cw, height: headH, color: FILL });
      page.drawLine({ start: { x: left, y }, end: { x: left + cw, y }, thickness: 0.8, color: BOX });
      let x = left;
      heads.forEach((lines, i) => {
        drawLines(lines, x + 4, y - 5, 7, 8.6);
        x += widths[i]!;
      });
      page.drawLine({ start: { x: left, y: y - headH }, end: { x: left + cw, y: y - headH }, thickness: 0.5, color: RULE });
      y -= headH;
    };
    ensure(headH + minRowH + 4);
    drawHead();
    for (const row of rows) {
      const cells = row.map((cell, i) =>
        typeof cell === "string"
          ? { kind: "text" as const, lines: wrap(safe(cell), regular, 8.5, widths[i]! - 8) }
          : "label" in cell
            ? { kind: "label" as const, lines: stacked(cell.label, widths[i]! - 8, 7.5) }
            : { kind: "options" as const, options: cell.options },
      );
      const rowH = Math.max(
        minRowH,
        ...cells.map((c, i) =>
          c.kind === "text"
            ? c.lines.length * 10.5 + 9
            : c.kind === "label"
              ? c.lines.length * 9.2 + 10
              : c.options.reduce((s, o) => s + Math.max(biLines(o.label, widths[i]! - 20, 7.5).length * 9.2, 10) + 3, 0) + 8,
        ),
      );
      if (y - rowH < BOTTOM) {
        newPage();
        drawHead();
      }
      let x = left;
      cells.forEach((c, i) => {
        if (c.kind === "text") c.lines.forEach((line, k) => page.drawText(line, { x: x + 4, y: y - 12 - k * 10.5, size: 8.5, font: regular, color: INK }));
        else if (c.kind === "label") drawLines(c.lines, x + 4, y - 5, 7.5, 9.2);
        else {
          let t = y - 5;
          for (const o of c.options) {
            checkbox(x + 4, t - 0.5, o.checked);
            const lines = biLines(o.label, widths[i]! - 20, 7.5);
            drawLines(lines, x + 15, t, 7.5, 9.2);
            t -= Math.max(lines.length * 9.2, 10) + 3;
          }
        }
        if (i > 0) page.drawLine({ start: { x, y }, end: { x, y: y - rowH }, thickness: 0.5, color: RULE });
        x += widths[i]!;
      });
      page.drawLine({ start: { x: left, y: y - rowH }, end: { x: left + cw, y: y - rowH }, thickness: 0.5, color: RULE });
      y -= rowH;
    }
    page.drawLine({ start: { x: left, y }, end: { x: left + cw, y }, thickness: 0.8, color: BOX });
    y -= 10;
  };

  /** Amount lines in two columns, each with its box (Schedule C part II). */
  const amountColumns = (items: { label: Bi; value: string }[]) => {
    const gap = 22;
    const colW = (cw - gap) / 2;
    const boxW = 74;
    const half = Math.ceil(items.length / 2);
    for (let i = 0; i < half; i++) {
      const row = [items[i], items[i + half]].filter(Boolean) as { label: Bi; value: string }[];
      const lines = row.map((r) => stacked(r.label, colW - boxW - 10, 7.5));
      const h = Math.max(19, ...lines.map((l) => l.length * 9.2 + 4));
      ensure(h + 6);
      row.forEach((r, j) => {
        const x = left + j * (colW + gap);
        drawLines(lines[j]!, x, y - 2, 7.5, 9.2);
        roundRect(x + colW - boxW, y, boxW, 17, 4, { border: BOX });
        const v = safe(formatAmount(r.value));
        page.drawText(v, { x: x + colW - 5 - width(v, 8.5), y: y - 11.5, size: 8.5, font: regular, color: INK });
        page.drawLine({ start: { x, y: y - h - 2 }, end: { x: x + colW, y: y - h - 2 }, thickness: 0.4, color: RULE });
      });
      y -= h + 6;
    }
  };

  /** Shaded line with a total box on the right. */
  const totalLine = (label: Bi, value: string) => {
    const lines = stacked(label, cw - 120, 8);
    const h = lines.length * 10 + 10;
    ensure(h + 8);
    roundRect(left, y, cw, h, 5, { fill: FILL });
    drawLines(lines, left + 12, y - 5, 8, 10);
    roundRect(left + cw - 96, y - (h - 17) / 2, 88, 17, 4, { border: BOX, fill: rgb(1, 1, 1) });
    const v = safe(formatAmount(value));
    page.drawText(v, { x: left + cw - 13 - width(v, 8.5), y: y - (h - 17) / 2 - 11.5, size: 8.5, font: bold, color: INK });
    y -= h + 10;
  };

  const images = new Map<PdfSignature, PDFImage | null>();
  const signatureImage = async (s: PdfSignature | null) => {
    if (!s) return null;
    if (!images.has(s)) {
      let image: PDFImage | null = null;
      if (s.png) {
        try {
          image = await doc.embedPng(s.png);
        } catch {
          image = null;
        }
      }
      images.set(s, image);
    }
    return images.get(s) ?? null;
  };

  /** Signature lines with the e-signatures drawn above them. */
  const signatureRow = async (cols: { caption: Bi; signature?: PdfSignature | null; text?: string }[]) => {
    const gap = 26;
    const colW = (cw - gap * (cols.length - 1)) / cols.length;
    const captions = cols.map((c) => stacked(c.caption, colW, 7.5));
    const capH = Math.max(...captions.map((c) => c.length)) * 9.2;
    ensure(60 + capH + 12);
    const line = y - 52;
    for (const [i, c] of cols.entries()) {
      const x = left + i * (colW + gap);
      const image = await signatureImage(c.signature ?? null);
      if (image) {
        const scale = Math.min((colW - 4) / image.width, 46 / image.height, 1);
        page.drawImage(image, { x, y: line + 3, width: image.width * scale, height: image.height * scale });
      } else if (c.text) {
        page.drawText(safe(c.text), { x, y: line + 6, size: 9.5, font: regular, color: INK });
      }
      page.drawLine({ start: { x, y: line }, end: { x: x + colW, y: line }, thickness: 0.8, color: INK });
      drawLines(captions[i]!, x, line - 4, 7.5, 9.2);
      if (c.signature) page.drawText(safe(`${c.signature.name} · ${c.signature.method}`), { x, y: line - 6 - capH - 8, size: 7, font: regular, color: MUTED });
    }
    y = line - 4 - capH - 18;
  };

  /** Dashed office-use box: content inside is drawn narrower. */
  const officeBox = (estimate: number, body: () => void) => {
    section("", ["Office use only", "Solo para uso de la oficina"]);
    ensure(estimate);
    const top = y;
    left = M + 14;
    cw = CW - 28;
    y -= 12;
    body();
    left = M;
    cw = CW;
    roundRect(M, top, CW, top - y, 6, { border: BOX, dash: true });
    y -= 12;
  };
  const officeGrid = (label: Bi, items: Bi[]) => {
    note(label);
    checkGrid(
      items.map((b) => ({ label: b, checked: false })),
      3,
    );
  };

  const id = (v: string | undefined) => (!v ? "" : full ? v : maskTaxId(v));
  const name = (p: { firstName: string; middleInitial: string; lastName: string }) => [p.firstName, p.middleInitial].filter(Boolean).join(" ");
  const sumOf = (record: Record<string, string>) => sumAmounts(Object.values(record));
  const info = (yearOnly: boolean): Line => [
    seg(`Tax year ${year}`, INK, bold),
    seg(` / Año fiscal ${year}`, ES),
    ...(yearOnly ? [] : [seg(` · return filed in ${year + 1}`), seg(` / declaración presentada en ${year + 1}`, ES)]),
  ];

  // ====================================================== intake sheet
  startSheet({
    title: ["Client Intake Sheet", "Hoja de admisión del cliente"],
    footer: ["Client Intake Sheet", "Client Intake Sheet"],
    info: info(false),
    right: `Client / Cliente: ${input.clientName} · Ref. ${input.reference}`,
  });
  callout([
    [
      "CONFIDENTIAL — contains Social Security numbers. Keep it in the client's file; never photograph it or send it by chat or e-mail.",
      "CONFIDENCIAL — contiene números de Seguro Social. Guárdela en el expediente del cliente; nunca la fotografíe ni la envíe por chat o correo.",
    ],
  ]);

  const tp = data.taxpayer;
  const idTypes: Opt[] = (
    [
      ["Driver's license", "Licencia de conducir"],
      ["State ID", "ID estatal"],
      ["Passport", "Pasaporte"],
      ["Consular ID", "Matrícula consular"],
      ["Other", "Otra"],
    ] as Bi[]
  ).map((label) => ({ label, checked: false }));
  const personBlock = (p: (typeof data)["spouse"] | typeof tp | null, language: string) => {
    fieldRow([
      { label: ["Last name(s) — exactly as on the Social Security card", "Apellido(s) — exactamente como en la tarjeta de Seguro Social"], value: p?.lastName },
      { label: ["First name and middle initial", "Nombre e inicial del segundo nombre"], value: p ? name(p) : "" },
    ]);
    fieldRow([
      { label: ["SSN or ITIN", "SSN o ITIN"], value: id(p?.ssn) },
      { label: ["Date of birth", "Fecha de nacimiento"], value: usDate(p?.dob ?? "") },
      { label: ["Occupation", "Ocupación"], value: p?.occupation },
    ]);
    fieldRow([
      { label: ["Phone", "Teléfono"], value: p?.cellPhone },
      { label: ["E-mail", "Correo electrónico"], value: p?.email },
      {
        label: ["Preferred language", "Idioma preferido"],
        options: [
          { label: ["English", "Inglés"], checked: language === "en" },
          { label: ["Spanish", "Español"], checked: language === "es" },
        ],
      },
    ]);
    fieldRow([
      { label: ["Photo ID type (verified by the preparer)", "Tipo de identificación con foto (la verifica el preparador)"], options: idTypes, vertical: true },
      { label: ["ID state / country of issue", "Estado / país que la emitió"] },
      { label: ["ID expiration", "Vencimiento de la identificación"] },
    ]);
    yesNo(MAIN.usCitizen, p?.usCitizen ?? "");
  };

  section("A", ["Taxpayer", "Contribuyente"]);
  personBlock(tp, data.preferredLanguage);
  choices(fill(MAIN.maritalStatus, { year }), opts(MARITAL_STATUSES, MARITAL_LABELS, data.maritalStatus));
  const deathYear = data.spouseDeathYear || data.deceasedSpouse?.dateOfDeath.slice(0, 4) || "";
  fieldRow([{ label: MAIN.spouseDeathYear, value: deathYear }, { label: ["", ""], spacer: true }, { label: ["", ""], spacer: true }]);
  fieldRow([{ label: ["Home address (street, apt.)", "Dirección (calle, apto.)"], value: `${tp.street}${tp.apt ? `, ${tp.apt}` : ""}` }]);
  fieldRow([
    { label: ["City", "Ciudad"], value: tp.city, w: 1.7 },
    { label: ["State", "Estado"], value: tp.state, w: 0.8 },
    { label: ["ZIP", "Código postal"], value: tp.zip, w: 1 },
  ]);
  fieldRow([{ label: MAIN.county, value: data.county }]);
  yesNo(fill(MAIN.multiState, { year }), data.multiState);
  textArea(fill(MAIN.statesDetail, { year }), data.statesDetail, 3);
  choices(MAIN.housing, opts(HOUSING, HOUSING_LABELS, data.housing));

  section("B", ["Spouse", "Cónyuge"]);
  note(["Complete only if married", "Complete solo si está casado(a)"]);
  personBlock(data.spouse, data.spouse ? data.preferredLanguage : "");

  section("C", ["Dependents and other people who lived in the home", "Dependientes y otras personas que vivieron en el hogar"]);
  yesNo(fill(["Do you have dependents, or did anyone else live in your home in {year}?", "¿Tiene dependientes o alguien más vivió en su hogar en {year}?"], { year }), data.hasDependents);
  const depRows: Cell[][] = Array.from({ length: Math.max(5, data.dependents.length) }, (_, i) => {
    const d = data.dependents[i];
    return [
      String(i + 1),
      d?.fullName ?? "",
      id(d?.ssn),
      usDate(d?.dob ?? ""),
      d ? (RELATIONSHIP_LABELS[d.relationship] ?? [d.relationship, d.relationship]).join(" / ") : "",
      d ? String(d.months) : "",
      { options: yesNoOpts(d?.student ?? "") },
      { options: yesNoOpts(d?.disabled ?? "") },
      { options: opts(CLAIMABLE, CLAIMABLE_LABELS, d?.claimable ?? "") },
    ];
  });
  table(
    [
      { label: ["#", "#"], w: 0.35 },
      { label: ["Name (as on SSN card)", "Nombre (como en la tarjeta de SSN)"], w: 2.2 },
      { label: ["SSN / ITIN", "SSN / ITIN"], w: 1.25 },
      { label: ["Date of birth", "Fecha de nacimiento"], w: 1.1 },
      { label: ["Relationship", "Parentesco"], w: 1.3 },
      { label: [`Months in your home in ${year}`, `Meses en su hogar en ${year}`], w: 1 },
      { label: MAIN.student, w: 1.05 },
      { label: MAIN.disabled, w: 1.05 },
      { label: MAIN.claimable, w: 2 },
    ],
    depRows,
    30,
  );
  callout([
    [
      `For each child claimed for a credit, the office keeps a copy of: Social Security card · birth certificate · one document showing the child's name and this address for ${year} (school, medical, daycare, landlord or agency letter).`,
      `Por cada hijo reclamado para un crédito, la oficina conserva copia de: tarjeta de Seguro Social · acta de nacimiento · un documento que muestre el nombre del niño y esta dirección en ${year} (carta de escuela, médico, guardería, arrendador o agencia).`,
    ],
  ]);

  section("D", [`Income received in ${year}`, `Ingresos recibidos en ${year}`]);
  note(["Check all that apply and bring the forms", "Marque todo lo que aplique y traiga los formularios"]);
  const income = new Set<string>(data.income);
  if (income.has("socialSecurity")) income.add("retirement");
  checkGrid(
    Object.keys(INCOME_LABELS)
      .filter((k) => k !== "socialSecurity")
      .map((k) => ({ label: INCOME_LABELS[k]!, checked: income.has(k) })),
  );
  const details = data.incomeDetails;
  sub(INCOME_LABELS.w2!);
  fieldRow([
    { label: MAIN.w2Employers, value: details.w2Employers },
    { label: MAIN.tipsOvertime, options: yesNoOpts(details.tipsOvertime), w: 2 },
  ]);
  sub(INCOME_LABELS.selfEmployment!);
  textArea(MAIN.describeWork, data.businessDescription, 3);
  yesNo(MAIN.keepsRecords, details.keepsRecords);
  sub(INCOME_LABELS.necMisc!);
  yesNo(MAIN.necIsBusiness, details.necIsBusiness);
  sub(INCOME_LABELS.paymentApps!);
  yesNo(MAIN.kIsBusiness, details.kIsBusiness);
  sub(INCOME_LABELS.other!);
  fieldRow([{ label: MAIN.otherIncome, value: data.otherIncome }]);

  section("E", [`Life events and expenses in ${year}`, `Eventos y gastos en ${year}`]);
  const ded = new Set<string>(data.deductions);
  if (ded.has("mortgage") || ded.has("propertyTax") || data.questions.homeSale === "yes") ded.add("home");
  if (ded.has("studentLoan")) ded.add("tuition");
  const letters = data.questions.irsLetter === "yes" || data.questions.movedState === "yes" || Boolean(tp.ipPin) || Boolean(data.spouse?.ipPin);
  const lettersLabel: Bi = ["IRS or state letter received · IP PIN · moved or changed states", "Carta del IRS o del estado · IP PIN · se mudó o cambió de estado"];
  checkGrid([
    ...["childcare", "tuition", "marketplace", "home", "estimatedPayments", "retirementContrib", "teacher", "carLoan", "charity"].map((k) => ({
      label: DEDUCTION_LABELS[k]!,
      checked: ded.has(k),
    })),
    { label: lettersLabel, checked: letters },
  ]);
  sub(DEDUCTION_LABELS.childcare!);
  const providers = data.childcare.length ? data.childcare : data.childcareProvider ? [{ provider: data.childcareProvider, ein: "", amount: "" }] : [];
  table(
    [
      { label: ["#", "#"], w: 0.4 },
      { label: MAIN.childcareProvider, w: 4 },
      { label: MAIN.childcareEin, w: 2.4 },
      { label: MAIN.childcareAmount, w: 3 },
    ],
    Array.from({ length: Math.max(2, providers.length) }, (_, i) => {
      const p = providers[i];
      return [String(i + 1), p?.provider ?? "", p?.ein ?? "", formatAmount(p?.amount ?? "")];
    }),
  );
  sub(DEDUCTION_LABELS.estimatedPayments!);
  textArea(MAIN.estimatedDetails, data.estimatedDetails, 3);
  sub(lettersLabel);
  const pinNote = [tp.ipPin ? `IP PIN (taxpayer / contribuyente): ${full ? tp.ipPin : "******"}` : "", data.spouse?.ipPin ? `IP PIN (spouse / cónyuge): ${full ? data.spouse.ipPin : "******"}` : ""];
  textArea(["Tell us more", "Cuéntenos más"], [data.questionDetails.irsLetter, data.questionDetails.movedState, ...pinNote].filter(Boolean).join("\n"), 3);

  section("F", ["Due-diligence questions", "Preguntas de debida diligencia"]);
  note(MAIN.ddIntro);
  textArea(fill(MAIN.dd1, { year }), data.dueDiligence.homeCost, 3);
  textArea(fill(MAIN.dd2, { year }), data.dueDiligence.childResidence, 3);
  yesNo(MAIN.dd3, data.dueDiligence.creditDisallowed);
  fieldRow([{ label: MAIN.ddYear, value: data.dueDiligence.disallowedYear }, { label: ["", ""], spacer: true }, { label: ["", ""], spacer: true }]);
  callout([["4. Self-employed: answered in the Schedule C section (J).", "4. Por cuenta propia: se responde en la sección del Anexo C (J)."]]);

  section("G", ["Refund, payment and records", "Reembolso, pago y registros"]);
  const refund = data.refund;
  fieldRow([
    { label: ["Direct deposit?", "¿Depósito directo?"], options: yesNoOpts(refund.method === "direct" ? "yes" : "no") },
    { label: MAIN.priorReturn, options: yesNoOpts(data.priorReturn) },
    { label: MAIN.otherStateLastYear, options: yesNoOpts(data.otherStateLastYear) },
  ]);
  if (refund.method === "direct") {
    fieldRow([
      { label: ["Bank", "Banco"], value: refund.bankName, w: 1.4 },
      { label: ["Routing number", "Número de ruta"], value: full ? refund.routing : `*****${refund.routing.slice(-4)}` },
      { label: ["Account number", "Número de cuenta"], value: full ? refund.account : `****${refund.account.slice(-4)}` },
      { label: ["Type", "Tipo"], value: refund.accountType === "savings" ? "Savings / Ahorros" : "Checking / Corriente", w: 0.9 },
    ]);
  } else {
    note(
      refund.method === "applyNext"
        ? ["Refund: apply to next year's tax", "Reembolso: aplicar al impuesto del próximo año"]
        : ["Refund: check by mail", "Reembolso: cheque por correo"],
    );
  }
  callout([
    [
      "Bank details are collected only in person or through the office's secure channel — never by chat, text or e-mail.",
      "Los datos bancarios se recogen solo en persona o por el canal seguro de la oficina — nunca por chat, mensaje de texto o correo.",
    ],
  ]);

  section("", ["Documents to bring", "Documentos que debe traer"]);
  const any = (...keys: string[]) => keys.some((k) => income.has(k) || ded.has(k));
  checkGrid([
    { label: ["Photo ID and Social Security / ITIN card for everyone on the return", "Identificación con foto y tarjeta de Seguro Social / ITIN de todos en la declaración"], checked: true },
    {
      label: [`For each child: birth certificate and one document with the child's name and your address for ${year}`, `Por cada hijo: acta de nacimiento y un documento con el nombre del niño y su dirección en ${year}`],
      checked: data.hasDependents === "yes",
    },
    { label: ["Every Form W-2", "Todos los Formularios W-2"], checked: any("w2") },
    { label: ["Forms 1099-NEC / 1099-MISC", "Formularios 1099-NEC / 1099-MISC"], checked: any("necMisc", "selfEmployment", "royalties") },
    { label: ["Forms 1099-K", "Formularios 1099-K"], checked: any("paymentApps") },
    { label: ["Form 1099-G", "Formulario 1099-G"], checked: any("unemployment") },
    { label: ["Forms 1099-INT / 1099-DIV", "Formularios 1099-INT / 1099-DIV"], checked: any("interestDividends") },
    { label: ["Forms 1099-R / SSA-1099", "Formularios 1099-R / SSA-1099"], checked: any("retirement") },
    { label: ["Forms W-2G and gambling records", "Formularios W-2G y registros de juegos"], checked: any("gambling") },
    { label: ["Childcare receipts with the provider's EIN / SSN", "Recibos de cuidado infantil con el EIN / SSN del proveedor"], checked: any("childcare") },
    { label: ["Forms 1098-T / 1098-E", "Formularios 1098-T / 1098-E"], checked: any("tuition") },
    { label: ["Form 1095-A", "Formulario 1095-A"], checked: any("marketplace") },
    { label: ["Form 1098, property tax bills and closing statement", "Formulario 1098, facturas del impuesto a la propiedad y estado de cierre"], checked: any("home") },
    { label: ["Confirmations of estimated tax payments", "Confirmaciones de pagos de impuesto estimado"], checked: any("estimatedPayments") },
    { label: ["IRA / retirement contribution statements", "Estados de aportes a IRA / jubilación"], checked: any("retirementContrib") },
    { label: ["Donation receipts", "Recibos de donaciones"], checked: any("charity") },
    { label: ["Car loan interest statement", "Estado de intereses del préstamo del auto"], checked: any("carLoan") },
    { label: ["IRS or state letters · IP PIN letter", "Cartas del IRS o del estado · carta del IP PIN"], checked: letters },
    { label: ["Last year's tax return", "La declaración del año pasado"], checked: data.priorReturn === "yes" },
  ]);

  section("H", ["Client confirmation and consent", "Confirmación y consentimiento del cliente"]);
  callout([
    [
      "I confirm that the information on this sheet is true, correct and complete to the best of my knowledge, and I will provide the documents requested. I understand the preparer may only discuss my return with me (and my spouse on a joint return) unless I give written consent for someone else.",
      "Confirmo que la información de esta hoja es verídica, correcta y completa a mi mejor saber y entender, y que entregaré los documentos solicitados. Entiendo que el preparador solo puede hablar de mi declaración conmigo (y con mi cónyuge en una declaración conjunta), salvo que yo dé consentimiento por escrito para otra persona.",
    ],
  ]);
  await signatureRow([
    { caption: ["Taxpayer signature", "Firma del contribuyente"], signature: input.signature },
    { caption: ["Spouse signature", "Firma del cónyuge"], signature: input.spouseSignature },
    { caption: ["Date", "Fecha"], text: input.signedAt },
  ]);
  fieldRow([{ label: MAIN.authorizedPerson, value: data.authorizedPerson }]);

  // Answers of the online form that have no box on the paper sheet.
  section("", ["Additional answers from the online form", "Respuestas adicionales del formulario en línea"]);
  const rows: { label: Bi; value: string }[] = [
    { label: ["Filing status chosen", "Estado civil tributario elegido"], value: (FILING_LABELS[data.filingStatus] ?? [data.filingStatus, ""]).join(" / ") },
    { label: ["Work phone", "Teléfono del trabajo"], value: tp.workPhone },
    { label: ["Taxpayer legally blind?", "¿Contribuyente legalmente ciego(a)?"], value: tp.blind === "yes" ? "Yes / Sí" : "No" },
    { label: ["Can someone claim the taxpayer?", "¿Alguien puede reclamar al contribuyente?"], value: tp.claimedByOther === "yes" ? "Yes / Sí" : "No" },
    ...(data.spouse
      ? [
          { label: ["Spouse legally blind?", "¿Cónyuge legalmente ciego(a)?"] as Bi, value: data.spouse.blind === "yes" ? "Yes / Sí" : "No" },
          { label: ["Can someone claim the spouse?", "¿Alguien puede reclamar al cónyuge?"] as Bi, value: data.spouse.claimedByOther === "yes" ? "Yes / Sí" : "No" },
        ]
      : []),
    ...(data.deceasedSpouse
      ? [
          {
            label: ["Deceased spouse", "Cónyuge fallecido(a)"] as Bi,
            value: `${[data.deceasedSpouse.firstName, data.deceasedSpouse.middleInitial, data.deceasedSpouse.lastName].filter(Boolean).join(" ")} · SSN ${id(data.deceasedSpouse.ssn)} · DOB ${usDate(data.deceasedSpouse.dob)} · † ${usDate(data.deceasedSpouse.dateOfDeath)}`,
          },
        ]
      : []),
    ...(["homeSale", "fullYearCoverage", "foreignAccounts"] as const).map((q) => ({
      label: QUESTION_LABELS[q]!,
      value: [data.questions[q] === "yes" ? "Yes / Sí" : "No", data.questionDetails[q]].filter(Boolean).join(" — "),
    })),
    {
      label: ["How did you hear about us?", "¿Cómo supo de nosotros?"],
      value: [biText(REFERRAL_LABELS[data.referral]) || data.referral, data.referralOther].filter(Boolean).join(" — "),
    },
    ...(data.notes ? [{ label: ["Notes", "Notas"] as Bi, value: data.notes }] : []),
  ];
  for (const r of rows) {
    const labelLines = stacked(r.label, 170, 7.5);
    const valueLines = wrap(safe(r.value || "—"), regular, 9, cw - 185);
    const h = Math.max(labelLines.length * 9.2, valueLines.length * 11.5) + 6;
    if (h > H - 200) {
      textArea(r.label, r.value, 3);
      continue;
    }
    ensure(h + 2);
    drawLines(labelLines, left, y, 7.5, 9.2);
    valueLines.forEach((line, i) => page.drawText(line, { x: left + 185, y: y - 9 - i * 11.5, size: 9, font: regular, color: INK }));
    page.drawLine({ start: { x: left, y: y - h }, end: { x: left + cw, y: y - h }, thickness: 0.4, color: RULE });
    y -= h + 3;
  }
  if (input.facePhoto) {
    let photo: PDFImage | null = null;
    try {
      photo = await doc.embedJpg(input.facePhoto);
    } catch {
      photo = null;
    }
    if (photo) {
      const scale = Math.min(100 / photo.width, 130 / photo.height, 1);
      ensure(photo.height * scale + 30);
      y -= 6;
      drawLine([seg("Photo taken at e-signing", INK, bold), seg(" / Foto tomada al firmar: ", ES, bold), seg(input.signature.name)], left, y, 7.5);
      y -= 13;
      page.drawImage(photo, { x: left, y: y - photo.height * scale, width: photo.width * scale, height: photo.height * scale });
      y -= photo.height * scale + 10;
    }
  }
  if (input.signerIp) note([`Signed electronically from IP ${input.signerIp} on ${input.signedAt}`, `Firmado electrónicamente desde la IP ${input.signerIp} el ${input.signedAt}`]);

  officeBox(190, () => {
    note(["Identity verified", "Identidad verificada"]);
    checkGrid(
      [
        { label: ["In person — photo ID inspected", "En persona — identificación revisada"], checked: false },
        { label: ["Remote — record check / video call", "Remoto — verificación / videollamada"], checked: false },
      ],
      3,
    );
    officeGrid(
      ["Documents received", "Documentos recibidos"],
      [
        ["SSN cards", "Tarjetas SSN"],
        ["Photo ID", "Identificación"],
        ["Birth certificates", "Actas de nacimiento"],
        ["Residency proof per child", "Prueba de residencia por hijo"],
        ["Income forms", "Formularios de ingresos"],
        ["Expense documents", "Documentos de gastos"],
        ["Prior return", "Declaración anterior"],
      ],
    );
    officeGrid(
      ["Form 8867?", "¿Formulario 8867?"],
      [
        ["EITC", "EITC"],
        ["CTC/ACTC/ODC", "CTC/ACTC/ODC"],
        ["AOTC", "AOTC"],
        ["HOH", "HOH"],
      ],
    );
  });
  fieldRow([
    { label: ["Client no.", "N.º de cliente"], value: input.reference },
    { label: ["Office", "Oficina"] },
    { label: ["Preparer · PTIN", "Preparador · PTIN"] },
  ]);
  fieldRow([{ label: ["Missing items / follow-up date", "Pendientes / fecha de seguimiento"] }]);

  // ===================================================== Schedule E
  if (needsScheduleE(data) && data.scheduleE) await scheduleESheet(data.scheduleE);

  // ===================================================== Schedule C
  if (needsScheduleC(data)) {
    for (const [i, b] of data.businesses.entries()) await scheduleCSheet(b, i, data.businesses.length);
  }

  async function scheduleESheet(e: IntakeScheduleE) {
    startSheet({
      title: ["Schedule E Intake — Rental Property, Royalties and K-1s", "Hoja del Anexo E — Propiedad de alquiler, regalías y K-1"],
      footer: ["Schedule E", "Schedule E"],
      info: info(true),
      right: `Client / Cliente: ${input.clientName} · Sheet 1 of 1 / Hoja 1 de 1`,
    });
    callout([["CONFIDENTIAL — attach to the Client Intake Sheet and keep in the client's file.", "CONFIDENCIAL — adjúntela a la Hoja de admisión del cliente y guárdela en el expediente."]]);

    section("A", ["General questions", "Preguntas generales"]);
    fieldRow([
      { label: ["Owner", "Dueño(a)"], options: opts(OWNERS_E, OWNER_LABELS, e.owner), w: 1.6 },
      { label: ["Ownership % (if not 100 %)", "% de propiedad (si no es 100 %)"], value: e.ownershipPct ? `${e.ownershipPct} %` : "" },
    ]);
    for (const [k, en, es] of E_FLAGS) {
      yesNo(fill([en, es], { year }), e[k]);
      if (k === "shortTerm") callout([["This may belong on Schedule C instead — your preparer will review it with you.", "Esto podría ir en el Anexo C — su preparador lo revisará con usted."]]);
    }

    const props = PROPERTY_LETTERS.map((_, i) => e.properties[i]);
    const propCols = [
      { label: ["Line", "Línea"] as Bi, w: 1.85 },
      ...PROPERTY_LETTERS.map((l) => ({ label: [`Property ${l}`, `Propiedad ${l}`] as Bi, w: 1.7 })),
    ];
    const textRow = (label: Bi, value: (p: NonNullable<(typeof props)[number]>) => string): Cell[] => [
      { label },
      ...props.map((p) => (p ? value(p) : "")),
    ];
    const ynRow = (label: Bi, value: (p: NonNullable<(typeof props)[number]>) => string): Cell[] => [
      { label },
      ...props.map((p) => ({ options: yesNoOpts(p ? value(p) : "") })),
    ];
    const show = (kind: string, v: string) => (kind === "money" ? formatAmount(v) : kind === "date" ? usDate(v) : v);

    section("B", ["Property details (lines 1a, 1b, 2)", "Datos de la propiedad (líneas 1a, 1b, 2)"]);
    table(propCols, [
      ...E_DETAILS.flatMap(([k, en, es, kind]) => {
        const rowCells = textRow(fill([en, es], { year }), (p) => show(kind, p[k]));
        if (k !== "address") return [rowCells];
        return [rowCells, textRow(["1b · Type of property", "1b · Tipo de propiedad"], (p) => (p.type ? PROPERTY_TYPE_LABELS[p.type].join(" / ") : ""))];
      }),
      ...E_PROPERTY_FLAGS.map(([k, en, es]) => ynRow([en, es], (p) => p[k])),
    ]);
    callout([
      [
        "Type of property: 1 Single family residence · 2 Multi-family residence · 3 Vacation / short-term rental · 4 Commercial · 5 Land · 6 Royalties · 7 Self-rental (rented to your own business) · 8 Other (describe)",
        "Tipo de propiedad: 1 Residencia unifamiliar · 2 Multifamiliar · 3 Vacacional / corto plazo · 4 Comercial · 5 Terreno · 6 Regalías · 7 Rentada a su propio negocio · 8 Otro (describa)",
      ],
    ]);

    section("C", [`Income — everything received in ${year} (lines 3–4)`, `Ingresos — todo lo recibido en ${year} (líneas 3–4)`]);
    table(propCols, [
      ...E_INCOME.map(([k, en, es]) => textRow(fill([en, es], { year }), (p) => formatAmount(p[k]))),
      ynRow(["Form 1099-MISC / 1099-K received?", "¿Recibió Formulario 1099-MISC / 1099-K?"], (p) => p.form1099),
    ]);
    callout([["Rent is income when received, whatever the lease says.", "La renta es ingreso cuando se recibe, diga lo que diga el contrato."]]);

    section("D", [`Expenses paid in ${year}, with receipts (lines 5–19)`, `Gastos pagados en ${year}, con recibos (líneas 5–19)`]);
    table(propCols, [
      ...E_EXPENSES.map(([k, en, es]) => textRow([en, es], (p) => formatAmount(p.expenses[k]))),
      textRow(["13a · Rental use % of the vehicle", "13a · % de uso del vehículo para el alquiler"], (p) => (p.vehiclePct ? `${p.vehiclePct} %` : "")),
      ynRow(
        ["18 · Depreciation is calculated by the preparer — do you have last year's depreciation schedule?", "18 · La depreciación la calcula el preparador — ¿tiene el cuadro de depreciación del año pasado?"],
        (p) => p.depreciationSchedule,
      ),
      textRow(["Total expenses", "Total de gastos"], (p) => formatAmount(sumOf(p.expenses))),
    ]);
    callout([
      [
        "Not deductible: loan principal, the land, your own labor, the personal-use share, improvements (listed in section E and depreciated).",
        "No deducibles: el capital del préstamo, el terreno, su propio trabajo, la parte de uso personal, las mejoras (se anotan en la sección E y se deprecian).",
      ],
    ]);

    section("E", [`Improvements, new assets and sales in ${year}`, `Mejoras, activos nuevos y ventas en ${year}`]);
    yesNo(
      [`Did you make improvements, buy assets, or sell or convert a rental in ${year}?`, `¿Hizo mejoras, compró activos, o vendió o convirtió un alquiler en ${year}?`],
      e.improvementsMade,
    );
    callout([
      [
        "Repairs keep the property working; improvements add value or extend its life (roof, HVAC, remodel, appliances).",
        "Las reparaciones mantienen la propiedad; las mejoras agregan valor o alargan su vida (techo, calefacción/aire, remodelación, electrodomésticos).",
      ],
    ]);
    table(
      [
        { label: ["#", "#"], w: 0.4 },
        { label: ["Property", "Propiedad"], w: 1 },
        { label: ["Description", "Descripción"], w: 3.2 },
        { label: ["Date", "Fecha"], w: 1.4 },
        { label: ["Cost or sale price", "Costo o precio de venta"], w: 1.4 },
        { label: ["Type", "Tipo"], w: 1.4 },
      ],
      Array.from({ length: Math.max(4, e.improvements.length) }, (_, i) => {
        const r = e.improvements[i];
        return [String(i + 1), r?.property ?? "", r?.description ?? "", usDate(r?.date ?? ""), formatAmount(r?.cost ?? ""), r?.type ?? ""];
      }),
    );
    callout([
      [
        "Sold or converted a rental? Bring the closing statement, Form 1099-S and the original purchase documents.",
        "¿Vendió o convirtió un alquiler? Traiga el estado de cierre, el Formulario 1099-S y los documentos de la compra original.",
      ],
    ]);

    section("F", ["Partnerships, S corporations, estates and trusts (K-1)", "Sociedades, corporaciones S, sucesiones y fideicomisos (K-1)"]);
    table(
      [
        { label: ["#", "#"], w: 0.4 },
        { label: ["Entity name", "Nombre de la entidad"], w: 2.6 },
        { label: ["EIN", "EIN"], w: 1.3 },
        { label: ["Type", "Tipo"], w: 1.3 },
        { label: ["K-1 received?", "¿K-1 recibido?"], w: 1.3 },
        { label: ["Materially participate?", "¿Participa materialmente?"], w: 1.3 },
        { label: ["Money invested or loaned (basis)", "Dinero invertido o prestado (base)"], w: 2 },
      ],
      Array.from({ length: Math.max(3, e.k1s.length) }, (_, i) => {
        const k = e.k1s[i];
        return [String(i + 1), k?.entity ?? "", k?.ein ?? "", k?.type ?? "", { options: yesNoOpts(k?.received ?? "") }, { options: yesNoOpts(k?.materially ?? "") }, formatAmount(k?.basis ?? "")];
      }),
      30,
    );
    yesNo(
      ["Losses from a prior year not allowed (at-risk, basis or passive limits — Form 8582)?", "¿Pérdidas de un año anterior no permitidas (límites de riesgo, base o actividad pasiva — Formulario 8582)?"],
      e.priorLosses,
    );

    section("G", ["Due-diligence questions", "Preguntas de debida diligencia"]);
    note(MAIN.ddIntro);
    for (const [k, en, es] of E_DUE_DILIGENCE) textArea(fill([en, es], { year }), e.dueDiligence[k], 3);

    section("H", ["Bring with this sheet", "Traiga con esta hoja"]);
    checkGrid(
      (
        [
          ["Form 1098 for each mortgage · property tax bills · insurance statements", "Formulario 1098 de cada hipoteca · facturas del impuesto a la propiedad · estados del seguro"],
          ["Leases · rent ledger or app reports · bank statements of the rental account", "Contratos · libro de rentas o reportes de la aplicación · estados de cuenta del alquiler"],
          ["Receipts for repairs, supplies, utilities, management, HOA", "Recibos de reparaciones, suministros, servicios, administración, asociación"],
          ["Last year's Schedule E and depreciation schedule", "El Anexo E y el cuadro de depreciación del año pasado"],
          ["Invoices for improvements · closing statement and Form 1099-S of any property sold", "Facturas de mejoras · estado de cierre y Formulario 1099-S de cualquier propiedad vendida"],
          ["Forms 1099-NEC you issued", "Formularios 1099-NEC que emitió"],
          ["Forms 1099-MISC / 1099-K received", "Formularios 1099-MISC / 1099-K recibidos"],
          ["Every Schedule K-1", "Cada Anexo K-1"],
          ["Form 8582 from last year", "El Formulario 8582 del año pasado"],
        ] as Bi[]
      ).map((label) => ({ label, checked: false })),
    );

    section("I", ["Client confirmation", "Confirmación del cliente"]);
    callout([
      [
        `The amounts on this sheet are complete and were paid for these properties in ${year}; I can provide the records that support them. I understand that improvements are depreciated, that loan principal and my own labor are not expenses, and that personal use of a property reduces the deduction.`,
        `Los montos de esta hoja están completos y se pagaron para estas propiedades en ${year}; puedo entregar los registros que los respaldan. Entiendo que las mejoras se deprecian, que el capital del préstamo y mi propio trabajo no son gastos, y que el uso personal de una propiedad reduce la deducción.`,
      ],
    ]);
    await signatureRow([
      { caption: ["Taxpayer signature", "Firma del contribuyente"], signature: input.signature },
      { caption: ["Spouse signature (co-owner)", "Firma del cónyuge (copropietario)"], signature: e.owner === "taxpayer" ? null : input.spouseSignature },
      { caption: ["Date", "Fecha"], text: input.signedAt },
    ]);

    officeBox(170, () => {
      officeGrid(
        ["Documents received", "Documentos recibidos"],
        [
          ["Forms 1098", "Formularios 1098"],
          ["Tax bills", "Facturas de impuestos"],
          ["Insurance", "Seguro"],
          ["Leases / rent ledger", "Contratos / libro de rentas"],
          ["Expense receipts", "Recibos de gastos"],
          ["Closing statement / 1099-S", "Estado de cierre / 1099-S"],
          ["Prior Schedule E + depreciation", "Anexo E anterior + depreciación"],
          ["Schedules K-1", "Anexos K-1"],
          ["1099-MISC / K", "1099-MISC / K"],
          ["1099-NEC issued", "1099-NEC emitidos"],
        ],
      );
      officeGrid(
        ["Preparer checks", "Verificaciones del preparador"],
        [
          ["Rental vs. Schedule C", "Alquiler vs. Anexo C"],
          ["Personal-use allocation", "Asignación de uso personal"],
          ["Basis: building vs. land", "Base: edificio vs. terreno"],
          ["Depreciation (27.5 / 39 yrs)", "Depreciación (27.5 / 39 años)"],
          ["Form 4562", "Formulario 4562"],
          ["Form 8582 · $25,000 allowance", "Formulario 8582 · deducción de $25,000"],
          ["Form 6198 at-risk", "Formulario 6198 en riesgo"],
          ["QBI rental safe harbor (250 h)", "QBI puerto seguro (250 h)"],
          ["Form 4797 / Schedule D if sold", "Formulario 4797 / Anexo D si vendió"],
        ],
      );
    });
    fieldRow([
      { label: ["Preparer initials", "Iniciales del preparador"] },
      { label: ["Missing items / follow-up date", "Pendientes / fecha de seguimiento"], w: 2.2 },
    ]);
    section("K", ["Preparer notes", "Notas del preparador"]);
    fieldRow([{ label: ["", ""], lines: 5 }]);
  }

  async function scheduleCSheet(b: IntakeBusiness, index: number, count: number) {
    startSheet({
      title: ["Schedule C Intake — Self-Employment / Business", "Hoja del Anexo C — Trabajo por cuenta propia / negocio"],
      footer: ["Schedule C", "Schedule C"],
      info: info(true),
      right: `Client / Cliente: ${input.clientName} · Business ${index + 1} of ${count} / Negocio ${index + 1} de ${count}`,
    });
    callout([
      [
        "CONFIDENTIAL — one sheet per business · attach to the Client Intake Sheet and keep in the client's file.",
        "CONFIDENCIAL — una hoja por negocio · adjúntela a la Hoja de admisión del cliente y guárdela en el expediente.",
      ],
    ]);

    section("A", ["The business (lines A–J)", "El negocio (líneas A–J)"]);
    choices(["Owner", "Dueño(a)"], opts(OWNERS_C, OWNER_LABELS, b.owner));
    fieldRow([{ label: ["A · Principal business or profession, including product or service", "A · Actividad o profesión principal, incluido el producto o servicio"], value: b.activity }]);
    fieldRow([
      { label: ["C · Business name (blank if none)", "C · Nombre del negocio (en blanco si no tiene)"], value: b.name, w: 2 },
      { label: ["D · EIN (blank if none)", "D · EIN (en blanco si no tiene)"], value: b.ein, w: 1 },
      { label: ["Date started / acquired", "Fecha en que empezó / adquirió"], value: usDate(b.started), w: 1 },
    ]);
    yesNo(["E · Is the business address the same as your home?", "E · ¿La dirección del negocio es la misma de su casa?"], b.sameAddress);
    fieldRow([{ label: ["Business address", "Dirección del negocio"], value: b.address }]);
    fieldRow([
      { label: ["F · Accounting method", "F · Método contable"], options: opts(ACCOUNTING_METHODS, ACCOUNTING_LABELS, b.method), w: 2 },
      { label: ["Describe", "Describa"], value: b.methodOther },
    ]);
    for (const [k, en, es] of C_FLAGS) yesNo(fill([en, es], { year }), b[k]);

    section("B", ["Income (Part I)", "Ingresos (Parte I)"]);
    fieldRow([
      { label: ["Number of Forms 1099-NEC / 1099-MISC", "Número de Formularios 1099-NEC / 1099-MISC"], value: b.count1099 },
      { label: ["Total on Forms 1099-NEC / 1099-MISC", "Total en Formularios 1099-NEC / 1099-MISC"], value: formatAmount(b.total1099) },
    ]);
    fieldRow([
      { label: ["Forms 1099-K (apps, cards, marketplaces) — gross amount", "Formularios 1099-K (aplicaciones, tarjetas, plataformas) — monto bruto"], value: formatAmount(b.gross1099K) },
      { label: ["1099-K: fees, refunds or personal items included?", "1099-K: ¿incluye comisiones, reembolsos o artículos personales?"], value: b.k1099Includes },
    ]);
    fieldRow([
      { label: ["Cash, check and app receipts NOT on any 1099", "Cobros en efectivo, cheque y aplicación que NO están en ningún 1099"], value: formatAmount(b.cashNotOn1099) },
      { label: ["Income records you keep", "Registros de ingresos que guarda"], options: opts(INCOME_RECORDS, INCOME_RECORD_LABELS, b.records) },
    ]);
    fieldRow([
      { label: ["2 · Returns and allowances (refunds to customers)", "2 · Devoluciones y descuentos (reembolsos a clientes)"], value: formatAmount(b.returns) },
      {
        label: ["6 · Other business income (fuel tax credit, recovered bad debts, prizes)", "6 · Otros ingresos del negocio (crédito de combustible, deudas recuperadas, premios)"],
        value: formatAmount(b.otherIncome),
      },
    ]);
    fieldRow([
      { label: ["1 · Gross receipts — the total of everything received", "1 · Ingresos brutos — el total de todo lo recibido"], value: formatAmount(b.grossReceipts) },
      { label: ["Does the total agree with your bank deposits?", "¿El total concuerda con sus depósitos bancarios?"], options: yesNoOpts(b.agreesDeposits) },
    ]);

    section("C", ["Bring with this sheet", "Traiga con esta hoja"]);
    checkGrid(
      (
        [
          ["All Forms 1099-NEC, 1099-K, 1099-MISC received", "Todos los Formularios 1099-NEC, 1099-K, 1099-MISC recibidos"],
          ["Income records: receipt book, invoices, app reports, bank statements", "Registros de ingresos: talonario, facturas, reportes de la aplicación, estados de cuenta"],
          ["Expense receipts, sorted by type", "Recibos de gastos, ordenados por tipo"],
          ["Mileage log (app export or notebook)", "Bitácora de millas (exportación de la app o libreta)"],
          [`Invoices for equipment or tools bought in ${year}`, `Facturas del equipo o herramientas compradas en ${year}`],
          [
            "Home expenses: rent or mortgage interest, utilities, insurance, repairs, property tax",
            "Gastos de la casa: renta o intereses hipotecarios, servicios, seguro, reparaciones, impuesto a la propiedad",
          ],
          ["Last year's Schedule C and depreciation schedule", "El Anexo C y el cuadro de depreciación del año pasado"],
          ["Forms 1099-NEC you issued · payroll forms (W-2, 941)", "Formularios 1099-NEC que emitió · formularios de nómina (W-2, 941)"],
          ["Health-insurance premium statements · Form 1095-A", "Estados de primas de seguro de salud · Formulario 1095-A"],
        ] as Bi[]
      ).map((label) => ({ label, checked: false })),
    );

    section("D", [`Expenses (Part II) — paid in ${year}, for the business, with receipts`, `Gastos (Parte II) — pagados en ${year}, para el negocio, con recibos`]);
    amountColumns(C_EXPENSES.map(([k, line, en, es]) => ({ label: [`${line} · ${en}`, `${line} · ${es}`] as Bi, value: b.expenses[k] })));
    totalLine(["Total expenses (without vehicle, home office and depreciation)", "Total de gastos (sin vehículo, oficina en casa ni depreciación)"], sumOf(b.expenses));
    callout([
      [
        "Line 9 (car and truck) goes in the Vehicle section · line 13 (depreciation) in the Equipment section · line 30 (home office) in its own section.",
        "La línea 9 (auto y camión) va en la sección Vehículo · la línea 13 (depreciación) en la sección Equipo · la línea 30 (oficina en casa) en su propia sección.",
      ],
    ]);
    fieldRow([
      { label: ["25 · Phone — % business use", "25 · Teléfono — % de uso de negocio"], value: b.phonePct ? `${b.phonePct} %` : "" },
      { label: ["25 · Internet — % business use", "25 · Internet — % de uso de negocio"], value: b.internetPct ? `${b.internetPct} %` : "" },
    ]);
    textArea(["27b · List of other expenses", "27b · Lista de otros gastos"], b.otherList, 3);
    callout([
      [
        "Not deductible — do not list: commuting to a job, meals alone, fines and tickets, everyday clothing, your own labor or money you took out of the business, loan principal, federal income tax, life insurance.",
        "No deducibles — no los anote: traslado a un empleo, comidas a solas, multas, ropa de uso diario, su propio trabajo o el dinero que retiró del negocio, el capital de un préstamo, el impuesto federal sobre la renta, el seguro de vida.",
      ],
    ]);

    const ho = b.homeOfficeDetail;
    section("E", ["Home office (line 30)", "Oficina en casa (línea 30)"]);
    choices(["Method", "Método"], opts(HOME_OFFICE_METHODS, HOME_OFFICE_METHOD_LABELS, ho.method));
    fieldRow([
      { label: ["Total square feet of the home", "Pies cuadrados totales de la casa"], value: ho.totalSqft },
      { label: ["Square feet used for business", "Pies cuadrados usados para el negocio"], value: ho.businessSqft },
      { label: [`Months used in ${year}`, `Meses usados en ${year}`], value: ho.months },
    ]);
    textArea(
      [
        "Amounts paid for the whole home (rent or mortgage interest, utilities, insurance, repairs, property tax)",
        "Montos pagados por toda la casa (renta o intereses hipotecarios, servicios, seguro, reparaciones, impuesto a la propiedad)",
      ],
      ho.homeExpenses,
      3,
    );

    const v = b.vehicleDetail;
    section("F", ["Vehicle (line 9 and Part IV)", "Vehículo (línea 9 y Parte IV)"]);
    sub(["Vehicle 1", "Vehículo 1"]);
    fieldRow([
      { label: ["Year, make and model", "Año, marca y modelo"], value: v.makeModel, w: 2 },
      { label: ["43 · Date placed in service for the business", "43 · Fecha en que empezó a usarlo para el negocio"], value: usDate(v.placedInService) },
    ]);
    fieldRow([
      { label: [`Total miles driven in ${year}`, `Millas totales manejadas en ${year}`], value: v.totalMiles },
      { label: ["44a · Business miles", "44a · Millas de negocio"], value: v.businessMiles },
      { label: ["44b · Commuting miles", "44b · Millas de traslado"], value: v.commutingMiles },
      { label: ["44c · Other miles", "44c · Otras millas"], value: v.otherMiles },
    ]);
    choices(["Mileage log kept?", "¿Lleva bitácora de millas?"], opts(MILEAGE_LOGS, MILEAGE_LOG_LABELS, v.log));
    yesNo(["47a/47b · Written evidence to support the deduction?", "47a/47b · ¿Evidencia escrita que respalde la deducción?"], v.writtenEvidence);
    fieldRow([
      { label: ["45 · Available for personal use off duty?", "45 · ¿Disponible para uso personal fuera del trabajo?"], options: yesNoOpts(v.personalOffDuty) },
      { label: ["46 · Another vehicle available for personal use?", "46 · ¿Hay otro vehículo para uso personal?"], options: yesNoOpts(v.otherVehicle) },
    ]);
    fieldRow([{ label: ["Method", "Método"], options: opts(VEHICLE_METHODS, VEHICLE_METHOD_LABELS, v.method), vertical: true }]);
    fieldRow(VEHICLE_COSTS.slice(0, 3).map(([k, en, es]) => ({ label: [en, es] as Bi, value: formatAmount(v[k]) })));
    fieldRow(VEHICLE_COSTS.slice(3).map(([k, en, es]) => ({ label: [en, es] as Bi, value: formatAmount(v[k]) })));
    fieldRow([{ label: ["Purchase price / date", "Precio / fecha de compra"], value: v.purchase }]);
    fieldRow([
      { label: ["Parking and tolls for business trips (either method)", "Estacionamiento y peajes de viajes de negocio (cualquier método)"], value: formatAmount(v.parkingTolls), w: 2 },
      { label: ["", ""], spacer: true },
    ]);

    section("G", ["Cost of goods sold (Part III)", "Costo de los bienes vendidos (Parte III)"]);
    const cogsField = (i: number): Field => {
      const [k, line, en, es] = COGS_LINES[i]!;
      return { label: [`${line} · ${en}`, `${line} · ${es}`], value: formatAmount(b.cogs[k]) };
    };
    fieldRow([cogsField(0), cogsField(1), cogsField(2)]);
    fieldRow([cogsField(3), cogsField(4)]);
    const c = b.cogs;
    const added = sumAmounts([c.beginning, c.purchases, c.labor, c.materials]);
    const cogs = added === "" && c.ending === "" ? "" : sumAmounts([added || "0", c.ending ? `${-Number(c.ending)}` : "0"]);
    fieldRow([{ label: ["42 · Cost of goods sold (35 + 36 + 37 + 38 − 41)", "42 · Costo de los bienes vendidos (35 + 36 + 37 + 38 − 41)"], value: formatAmount(cogs) }]);

    section("H", [`Equipment, tools and other assets bought or sold in ${year}`, `Equipo, herramientas y otros activos comprados o vendidos en ${year}`]);
    table(
      [
        { label: ["#", "#"], w: 0.4 },
        { label: ["Description", "Descripción"], w: 3.6 },
        { label: ["Date bought or sold", "Fecha de compra o venta"], w: 1.2 },
        { label: ["Cost or sale price", "Costo o precio de venta"], w: 1.2 },
        { label: ["Business use %", "% de uso de negocio"], w: 1.1 },
        { label: ["New / used / sold", "Nuevo / usado / vendido"], w: 1.1 },
      ],
      Array.from({ length: Math.max(4, b.assets.length) }, (_, i) => {
        const a = b.assets[i];
        return [
          String(i + 1),
          a?.description ?? "",
          usDate(a?.date ?? ""),
          formatAmount(a?.cost ?? ""),
          a?.pct ? `${a.pct} %` : "",
          a?.status ? ASSET_STATUS_LABELS[a.status].join(" / ") : "",
        ];
      }),
    );
    callout([
      [
        "Items over $2,500 each are depreciated (the preparer decides Section 179 / bonus); smaller tools go to other expenses.",
        "Los artículos de más de $2,500 cada uno se deprecian (el preparador decide la Sección 179 / bonificación); las herramientas pequeñas van a otros gastos.",
      ],
    ]);

    section("I", ["Health insurance, retirement and estimated taxes", "Seguro de salud, jubilación e impuestos estimados"]);
    note(["Applies to all your businesses", "Aplica a todos sus negocios"]);
    if (index === 0) {
      const shared = data.scheduleCShared;
      const sharedItems = C_SHARED.map(([k, en, es]) => ({ k, label: fill([en, es], { year, prev: year - 1 }) }));
      checkGrid(sharedItems.map((s) => ({ label: s.label, checked: shared[s.k] !== "" })));
      for (const s of sharedItems) {
        sub(s.label);
        fieldRow([{ label: ["Amount", "Monto"], value: formatAmount(shared[s.k]) }, { label: ["", ""], spacer: true }]);
      }
      callout([
        [
          `Marketplace coverage (Form 1095-A) and ${year} estimated payments are taken from section E of the Client Intake Sheet.`,
          `La cobertura del Mercado (Formulario 1095-A) y los pagos estimados de ${year} se toman de la sección E de la Hoja de admisión.`,
        ],
      ]);
    } else {
      callout([["Answered on the sheet of Business 1.", "Se responde en la hoja del Negocio 1."]]);
    }

    section("J", ["Due-diligence questions", "Preguntas de debida diligencia"]);
    note(MAIN.ddIntro);
    for (const [k, en, es] of C_DUE_DILIGENCE) textArea([en, es], b.dueDiligence[k], 3);

    section("K", ["Client confirmation", "Confirmación del cliente"]);
    callout([
      [
        `The amounts on this sheet are complete and were paid for this business in ${year}; I can provide the records that support them. I understand that commuting, personal expenses and my own labor are not business expenses.`,
        `Los montos de esta hoja están completos y se pagaron para este negocio en ${year}; puedo entregar los registros que los respaldan. Entiendo que el traslado, los gastos personales y mi propio trabajo no son gastos del negocio.`,
      ],
    ]);
    const ownerSignature = b.owner === "spouse" && input.spouseSignature ? input.spouseSignature : b.owner === "spouse" ? null : input.signature;
    await signatureRow([
      { caption: ["Owner signature", "Firma del dueño(a)"], signature: ownerSignature },
      { caption: ["Date", "Fecha"], text: input.signedAt },
    ]);

    officeBox(170, () => {
      officeGrid(
        ["Documents received", "Documentos recibidos"],
        [
          ["1099-NEC / K / MISC", "1099-NEC / K / MISC"],
          ["Income records", "Registros de ingresos"],
          ["Expense receipts", "Recibos de gastos"],
          ["Mileage log", "Bitácora de millas"],
          ["Asset invoices", "Facturas de activos"],
          ["Prior Schedule C + depreciation", "Anexo C anterior + depreciación"],
          ["Form 1095-A", "Formulario 1095-A"],
          ["1099-NEC filed for helpers", "1099-NEC presentados"],
        ],
      );
      officeGrid(
        ["Preparer checks", "Verificaciones del preparador"],
        [
          ["Business vs. hobby", "Negocio vs. pasatiempo"],
          ["Gross receipts = deposits", "Ingresos brutos = depósitos"],
          ["Schedule SE", "Anexo SE"],
          ["QBI (Form 8995)", "QBI (Formulario 8995)"],
          ["Form 4562", "Formulario 4562"],
          ["Form 8829", "Formulario 8829"],
          ["Form 7206", "Formulario 7206"],
          ["Form 8867 question 8", "Formulario 8867 pregunta 8"],
          [`${year + 1} estimated payments discussed`, `Pagos estimados ${year + 1} conversados`],
        ],
      );
    });
    fieldRow([
      { label: ["Preparer initials", "Iniciales del preparador"] },
      { label: ["Missing items / follow-up date", "Pendientes / fecha de seguimiento"], w: 2.2 },
    ]);
  }


  // ================================================ service agreement
  startSheet({ title: ["Service Agreement", "Acuerdo de servicios"], footer: ["Service Agreement", "Service Agreement"], info: info(true), right: `Client / Cliente: ${input.clientName}` });
  const para = (text: string, size = 9.5, font = regular, color = INK, indent = 0) => {
    for (const line of wrap(safe(text), font, size, cw - indent)) {
      ensure(size * 1.4);
      page.drawText(line, { x: left + indent, y: y - size, size, font, color });
      y -= size * 1.4;
    }
  };
  para(L.agreementTitle, 13, bold);
  y -= 4;
  para(input.agreement.intro);
  y -= 6;
  input.agreement.clauses.forEach((clause, i) => {
    ensure(40);
    para(`${i + 1}. ${clause.title}`, 10, bold);
    para(clause.body, 9.5, regular, INK, 14);
    y -= 6;
  });
  y -= 4;
  para(L.confirmationsTitle, 10.5, bold);
  y -= 2;
  for (const c of input.agreement.confirmations) {
    const lines = wrap(safe(c.label), regular, 9.5, cw - 18);
    ensure(lines.length * 13 + 4);
    checkbox(left, y - 1.5, c.checked);
    lines.forEach((line, i) => page.drawText(line, { x: left + 16, y: y - 9.5 - i * 13, size: 9.5, font: regular, color: INK }));
    y -= lines.length * 13 + 4;
  }
  y -= 8;
  await signatureRow([
    { caption: [L.signedBy, L.signedBy], signature: input.signature },
    ...(input.spouseSignature ? [{ caption: [L.spouseSignedBy, L.spouseSignedBy] as Bi, signature: input.spouseSignature }] : []),
    { caption: [L.signedAt, L.signedAt], text: input.signedAt },
  ]);
  if (input.signerIp) para(`${L.signerIp}: ${input.signerIp}`, 8, regular, MUTED);

  // ========================================================= documents
  y -= 10;
  ensure(80);
  para(L.documentsTitle, 13, bold);
  y -= 4;
  if (input.attachments.length === 0) para(L.documentsEmpty, 9.5, regular, MUTED);
  input.attachments.forEach((a, i) => {
    const embeddable = a.mime === "application/pdf" || a.mime.startsWith("image/");
    para(`${i + 1}. ${a.typeLabel} — ${a.name} (${a.sizeLabel})${embeddable ? "" : ` — ${L.documentsSeparate}`}`, 9.5);
  });

  // Attached PDFs and images, after the package.
  const coverPage = (heading: string, failed?: string) => {
    newPage();
    para(heading, 12, bold, BAR);
    if (failed) para(failed, 10, regular, MUTED);
    y -= 8;
  };
  for (const [i, a] of input.attachments.entries()) {
    if (!a.bytes) continue;
    const heading = `${L.attachmentHeading} ${i + 1} · ${a.typeLabel} · ${a.name}`;
    if (a.mime === "application/pdf") {
      try {
        const source = await PDFDocument.load(a.bytes, { ignoreEncryption: true, updateMetadata: false });
        const pages = await doc.copyPages(source, source.getPageIndices());
        if (pages.length === 0) throw new Error("empty");
        coverPage(heading);
        for (const p of pages) doc.addPage(p);
      } catch {
        coverPage(heading, L.attachmentFailed);
      }
      continue;
    }
    if (a.mime.startsWith("image/")) {
      try {
        const image = a.mime === "image/png" ? await doc.embedPng(a.bytes) : await doc.embedJpg(a.bytes);
        coverPage(heading);
        const scale = Math.min(CW / image.width, (y - BOTTOM) / image.height, 1);
        page.drawImage(image, { x: M, y: y - image.height * scale, width: image.width * scale, height: image.height * scale });
      } catch {
        coverPage(heading, L.attachmentFailed);
      }
    }
  }

  // Footer and page numbers
  const pages = doc.getPages();
  const company = safe("Element Multiservices LLC · CONFIDENTIAL / CONFIDENCIAL");
  pages.forEach((p, i) => {
    const label = safe(`Page ${i + 1} of ${pages.length} / Página ${i + 1} de ${pages.length}`);
    const { width: pw } = p.getSize();
    const footer = packagePages.get(p);
    if (footer) {
      p.drawLine({ start: { x: M, y: 40 }, end: { x: pw - M, y: 40 }, thickness: 0.5, color: RULE });
      p.drawText(company, { x: M, y: 27, size: 7.5, font: regular, color: INK });
      const center = safe(footer[0]);
      p.drawText(center, { x: (pw - width(center, 7.5)) / 2, y: 27, size: 7.5, font: regular, color: ES });
    }
    p.drawText(label, { x: pw - M - width(label, 7.5), y: 27, size: 7.5, font: regular, color: INK });
  });

  return doc.save();
}
