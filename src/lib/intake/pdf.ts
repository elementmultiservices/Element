import "server-only";
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import type { SummarySection } from "./summary";

/**
 * Builds the intake form PDF in three parts, like the paper form:
 * 1) intake answers and the signed declaration, 2) the service agreement with
 * its confirmations and signatures, 3) the list of documents. Every attached
 * PDF and image follows, so the whole file can be reviewed in one document.
 * Office files cannot be embedded and are listed for separate download.
 */

const PAGE = { width: 612, height: 792 }; // US Letter
const MARGIN = 50;
const CONTENT_WIDTH = PAGE.width - MARGIN * 2;
const LABEL_WIDTH = 170;
const INK = rgb(0.02, 0.05, 0.16);
const MUTED = rgb(0.38, 0.42, 0.5);
const ACCENT = rgb(0.11, 0.51, 0.96);
const BAND = rgb(0.94, 0.97, 1);
const RULE = rgb(0.85, 0.9, 0.96);
const HEADER = rgb(0.05, 0.08, 0.2);

export type PdfAttachment = {
  name: string;
  typeLabel: string;
  sizeLabel: string;
  mime: string;
  bytes: Uint8Array | null;
};

export type PdfLabels = {
  title: string;
  subtitle: string;
  packageParts: string;
  reference: string;
  submitted: string;
  part1: string;
  part2: string;
  part3: string;
  documentsEmpty: string;
  documentsSeparate: string;
  declarationTitle: string;
  declaration: string;
  confirmationsTitle: string;
  signedBy: string;
  spouseSignedBy: string;
  signedAt: string;
  signerIp: string;
  attachmentHeading: string;
  attachmentFailed: string;
  page: string;
};

export type PdfSignature = { name: string; png: Uint8Array | null; method: string };

export type PdfInput = {
  businessName: string;
  footer: string;
  labels: PdfLabels;
  sections: SummarySection[];
  agreement: { intro: string; clauses: { title: string; body: string }[]; confirmations: { label: string; checked: boolean }[] };
  attachments: PdfAttachment[];
  signature: PdfSignature;
  spouseSignature: PdfSignature | null;
  signedAt: string;
  signerIp: string | null;
};

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

export async function buildIntakePdf(input: PdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${input.labels.title} — ${input.labels.subtitle}`);
  doc.setAuthor(input.businessName);
  doc.setCreator(input.businessName);
  doc.setProducer(input.businessName);

  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const safe = encoder(regular);
  const L = input.labels;

  // Pages of the package itself (attachments keep their own layout).
  const packagePages: PDFPage[] = [];
  let page!: PDFPage;
  let y = 0;

  /** Dark band with the business name and the package title, as on the paper form. */
  const newPage = () => {
    page = doc.addPage([PAGE.width, PAGE.height]);
    packagePages.push(page);
    page.drawRectangle({ x: 0, y: PAGE.height - 70, width: PAGE.width, height: 70, color: HEADER });
    page.drawText(safe(input.businessName.toUpperCase()), { x: MARGIN, y: PAGE.height - 42, size: 16, font: bold, color: rgb(1, 1, 1) });
    const title = safe(L.title);
    page.drawText(title, { x: PAGE.width - MARGIN - bold.widthOfTextAtSize(title, 12), y: PAGE.height - 36, size: 12, font: bold, color: rgb(1, 1, 1) });
    const parts = safe(L.packageParts);
    page.drawText(parts, { x: PAGE.width - MARGIN - regular.widthOfTextAtSize(parts, 8.5), y: PAGE.height - 52, size: 8.5, font: regular, color: rgb(0.45, 0.65, 1) });
    y = PAGE.height - 100;
  };
  const ensure = (height: number) => {
    if (y - height < MARGIN + 20) newPage();
  };
  const textLines = (lines: string[], x: number, font: PDFFont, size: number, color = INK, lineHeight = size * 1.35) => {
    for (const line of lines) {
      ensure(lineHeight);
      page.drawText(line, { x, y: y - size, size, font, color });
      y -= lineHeight;
    }
  };
  const paragraph = (text: string, size = 10, font = regular, color = INK) => textLines(wrap(safe(text), font, size, CONTENT_WIDTH), MARGIN, font, size, color);

  const partTitle = (title: string) => {
    ensure(40);
    page.drawRectangle({ x: MARGIN, y: y - 18, width: 3, height: 16, color: ACCENT });
    page.drawText(safe(title), { x: MARGIN + 10, y: y - 14, size: 14, font: bold, color: INK });
    y -= 30;
  };

  const sectionTitle = (title: string) => {
    ensure(44);
    y -= 6;
    page.drawRectangle({ x: MARGIN, y: y - 20, width: CONTENT_WIDTH, height: 22, color: BAND });
    page.drawText(safe(title), { x: MARGIN + 8, y: y - 14, size: 11, font: bold, color: INK });
    y -= 30;
  };

  const row = (label: string, value: string) => {
    const labelLines = wrap(safe(label), bold, 9, LABEL_WIDTH - 10);
    const valueLines = wrap(safe(value), regular, 10, CONTENT_WIDTH - LABEL_WIDTH);
    const lineHeight = 13.5;
    const height = Math.max(labelLines.length, valueLines.length) * lineHeight;
    if (height > PAGE.height - MARGIN * 2 - 120) {
      // Very long values (notes) flow across pages below their label.
      textLines(labelLines, MARGIN, bold, 9, MUTED, lineHeight);
      textLines(valueLines, MARGIN, regular, 10, INK, lineHeight);
    } else {
      ensure(height + 4);
      labelLines.forEach((line, i) => page.drawText(line, { x: MARGIN, y: y - 9 - i * lineHeight, size: 9, font: bold, color: MUTED }));
      valueLines.forEach((line, i) =>
        page.drawText(line, { x: MARGIN + LABEL_WIDTH, y: y - 10 - i * lineHeight, size: 10, font: regular, color: INK }),
      );
      y -= height;
    }
    y -= 4;
  };

  const images = new Map<PdfSignature, PDFImage | null>();
  const signatureImage = async (s: PdfSignature) => {
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

  const signatureBlock = async (caption: string, s: PdfSignature) => {
    ensure(100);
    const image = await signatureImage(s);
    const top = y;
    if (image) {
      const scale = Math.min(230 / image.width, 60 / image.height, 1);
      page.drawImage(image, { x: MARGIN, y: y - image.height * scale, width: image.width * scale, height: image.height * scale });
    }
    y = top - 62;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + 260, y }, thickness: 0.8, color: INK });
    page.drawText(safe(L.signedAt), { x: MARGIN + 300, y: top - 40, size: 8, font: regular, color: MUTED });
    page.drawText(safe(input.signedAt), { x: MARGIN + 300, y: top - 54, size: 10, font: regular, color: INK });
    page.drawLine({ start: { x: MARGIN + 300, y }, end: { x: PAGE.width - MARGIN, y }, thickness: 0.8, color: RULE });
    y -= 4;
    textLines([safe(`${caption}: ${s.name} · ${s.method}`)], MARGIN, bold, 9, INK);
    y -= 8;
  };

  const signatures = async () => {
    await signatureBlock(L.signedBy, input.signature);
    if (input.spouseSignature) await signatureBlock(L.spouseSignedBy, input.spouseSignature);
  };

  // Part 1 · Intake --------------------------------------------------------
  newPage();
  textLines(wrap(safe(L.subtitle), bold, 16, CONTENT_WIDTH), MARGIN, bold, 16);
  textLines([safe(`${L.reference} · ${L.submitted}`)], MARGIN, regular, 9, MUTED);
  y -= 6;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE.width - MARGIN, y }, thickness: 1, color: RULE });
  y -= 16;

  partTitle(L.part1);
  for (const section of input.sections) {
    sectionTitle(section.title);
    for (const r of section.rows) row(r.label, r.value);
  }
  sectionTitle(L.declarationTitle);
  paragraph(L.declaration);
  y -= 10;
  await signatures();

  // Part 2 · Service agreement ---------------------------------------------
  newPage();
  partTitle(L.part2);
  paragraph(input.agreement.intro);
  y -= 6;
  input.agreement.clauses.forEach((clause, i) => {
    ensure(40);
    textLines([safe(`${i + 1}. ${clause.title}`)], MARGIN, bold, 10);
    textLines(wrap(safe(clause.body), regular, 9.5, CONTENT_WIDTH - 14), MARGIN + 14, regular, 9.5);
    y -= 6;
  });
  sectionTitle(L.confirmationsTitle);
  for (const c of input.agreement.confirmations) {
    const lines = wrap(safe(c.label), regular, 10, CONTENT_WIDTH - 22);
    ensure(lines.length * 13.5 + 4);
    page.drawRectangle({ x: MARGIN, y: y - 11, width: 10, height: 10, borderColor: ACCENT, borderWidth: 1 });
    if (c.checked) page.drawText("X", { x: MARGIN + 2, y: y - 9.5, size: 9, font: bold, color: ACCENT });
    textLines(lines, MARGIN + 22, regular, 10);
    y -= 4;
  }
  y -= 10;
  await signatures();
  if (input.signerIp) textLines([safe(`${L.signerIp}: ${input.signerIp}`)], MARGIN, regular, 8, MUTED);

  // Part 3 · Documents -----------------------------------------------------
  ensure(120);
  y -= 10;
  partTitle(L.part3);
  if (input.attachments.length === 0) {
    paragraph(L.documentsEmpty, 10, regular, MUTED);
  } else {
    input.attachments.forEach((a, i) => {
      const embeddable = a.mime === "application/pdf" || a.mime.startsWith("image/");
      row(`${i + 1}. ${a.typeLabel}`, `${a.name} (${a.sizeLabel})${embeddable ? "" : ` — ${L.documentsSeparate}`}`);
    });
  }

  // Attached PDFs and images, after the package.
  const coverPage = (heading: string, note?: string) => {
    newPage();
    textLines(wrap(safe(heading), bold, 12, CONTENT_WIDTH), MARGIN, bold, 12, ACCENT);
    if (note) textLines(wrap(safe(note), regular, 10, CONTENT_WIDTH), MARGIN, regular, 10, MUTED);
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
        const maxH = y - MARGIN;
        const scale = Math.min(CONTENT_WIDTH / image.width, maxH / image.height, 1);
        page.drawImage(image, { x: MARGIN, y: y - image.height * scale, width: image.width * scale, height: image.height * scale });
      } catch {
        coverPage(heading, L.attachmentFailed);
      }
    }
  }

  // Footer and page numbers
  const pages = doc.getPages();
  const footer = safe(input.footer);
  pages.forEach((p, i) => {
    const label = safe(`${L.page} ${i + 1} / ${pages.length}`);
    const { width } = p.getSize();
    if (packagePages.includes(p)) {
      p.drawLine({ start: { x: MARGIN, y: 38 }, end: { x: width - MARGIN, y: 38 }, thickness: 0.5, color: RULE });
      p.drawText(footer, { x: MARGIN, y: 24, size: 8, font: regular, color: MUTED });
    }
    p.drawText(label, { x: width - MARGIN - regular.widthOfTextAtSize(label, 8), y: 24, size: 8, font: regular, color: MUTED });
  });

  return doc.save();
}
