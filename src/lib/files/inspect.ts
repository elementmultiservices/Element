import "server-only";
import { createHash } from "node:crypto";
import { Decompress, strFromU8, unzipSync } from "fflate";
import type { FileKind } from "./rules";

export type InspectionFailure = "signatureMismatch" | "activeContent" | "corrupt";
export type InspectionResult = { ok: true } | { ok: false; reason: InspectionFailure };

const MAX_ZIP_ENTRIES = 5000;
const MAX_ZIP_UNCOMPRESSED = 200 * 1024 * 1024; // zip-bomb guard
const MAX_PDF_INFLATED = 50 * 1024 * 1024;

function startsWith(buf: Uint8Array, signature: number[]): boolean {
  if (buf.length < signature.length) return false;
  return signature.every((byte, i) => buf[i] === byte);
}

const SIGNATURES = {
  pdf: [0x25, 0x50, 0x44, 0x46, 0x2d], // %PDF-
  png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  jpg: [0xff, 0xd8, 0xff],
  zip: [0x50, 0x4b, 0x03, 0x04],
};

const OOXML_MAIN_TYPES: Record<"docx" | "xlsx" | "pptx", string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml",
};

// PDF names that trigger scripts, launch programs or carry embedded payloads.
// The short /JS key only counts when followed by a value (string, hex string or
// indirect reference): as a bare 3-byte sequence it turns up by chance inside
// binary image data (e.g. scanned JPEG pages) and rejected legitimate scans.
const PDF_ACTIVE = /\/(JavaScript|Launch|EmbeddedFiles?|RichMedia|SubmitForm|ImportData|GoToE)\b|\/JS\s*(\(|<|\d+\s+\d+\s+R\b)/;

/** Inflates zlib/deflate data, aborting once the output exceeds `limit` bytes. */
function boundedInflate(data: Uint8Array, limit: number): Uint8Array | null | "overflow" {
  const chunks: Uint8Array[] = [];
  let total = 0;
  let overflow = false;
  try {
    const stream = new Decompress((chunk) => {
      total += chunk.length;
      if (total > limit) {
        overflow = true;
        throw new Error("limit");
      }
      chunks.push(chunk);
    });
    stream.push(data, true);
  } catch {
    if (overflow) return "overflow";
    return null;
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

function inspectPdf(buf: Uint8Array): InspectionResult {
  if (!startsWith(buf, SIGNATURES.pdf)) return { ok: false, reason: "signatureMismatch" };
  const text = Buffer.from(buf).toString("latin1");
  if (PDF_ACTIVE.test(text)) return { ok: false, reason: "activeContent" };

  // Names can hide inside compressed (FlateDecode) streams: inflate with a
  // hard output limit (decompression-bomb guard) and rescan.
  const streamRe = /(?<!end)stream\r?\n/g;
  let budget = MAX_PDF_INFLATED;
  let match: RegExpExecArray | null;
  while ((match = streamRe.exec(text)) !== null) {
    const start = match.index + match[0].length;
    const end = text.indexOf("endstream", start);
    if (end === -1) break;
    streamRe.lastIndex = end + "endstream".length;

    const dictionary = text.slice(Math.max(0, match.index - 512), match.index);
    const dictStart = dictionary.lastIndexOf(" obj");
    if (!/\/FlateDecode/.test(dictStart === -1 ? dictionary : dictionary.slice(dictStart))) continue;

    const inflated = boundedInflate(buf.subarray(start, end), budget);
    if (inflated === "overflow") return { ok: false, reason: "corrupt" };
    if (inflated === null) continue; // undecodable stream: nothing to scan
    budget -= inflated.length;
    if (PDF_ACTIVE.test(Buffer.from(inflated).toString("latin1"))) return { ok: false, reason: "activeContent" };
  }
  return { ok: true };
}

function inspectOoxml(buf: Uint8Array, kind: "docx" | "xlsx" | "pptx"): InspectionResult {
  if (!startsWith(buf, SIGNATURES.zip)) return { ok: false, reason: "signatureMismatch" };

  const names: string[] = [];
  let declaredTotal = 0;
  let suspicious = false;
  let contentTypes: string | null = null;

  try {
    const files = unzipSync(buf, {
      filter(file) {
        names.push(file.name);
        declaredTotal += file.originalSize;
        if (names.length > MAX_ZIP_ENTRIES || declaredTotal > MAX_ZIP_UNCOMPRESSED) suspicious = true;
        return file.name === "[Content_Types].xml" && file.originalSize < 1024 * 1024;
      },
    });
    const ct = files["[Content_Types].xml"];
    if (ct) contentTypes = strFromU8(ct);
  } catch {
    return { ok: false, reason: "corrupt" };
  }

  if (suspicious || !contentTypes) return { ok: false, reason: "corrupt" };

  const activeEntry = names.some(
    (n) =>
      /vbaProject\.bin$/i.test(n) ||
      /(^|\/)activeX\//i.test(n) ||
      /\/embeddings\/.*\.(bin|exe|dll)$/i.test(n) ||
      /\.(exe|dll|bat|cmd|js|vbs|ps1|scr|com|msi|jar|hta|wsf|lnk)$/i.test(n),
  );
  if (activeEntry || /macroEnabled/i.test(contentTypes)) return { ok: false, reason: "activeContent" };
  if (!contentTypes.includes(OOXML_MAIN_TYPES[kind])) return { ok: false, reason: "signatureMismatch" };
  return { ok: true };
}

/** Verifies that the real content matches the declared type and carries no executable content. */
export function inspectFile(buf: Uint8Array, kind: FileKind): InspectionResult {
  switch (kind) {
    case "pdf":
      return inspectPdf(buf);
    case "png":
      return startsWith(buf, SIGNATURES.png) ? { ok: true } : { ok: false, reason: "signatureMismatch" };
    case "jpg":
      return startsWith(buf, SIGNATURES.jpg) ? { ok: true } : { ok: false, reason: "signatureMismatch" };
    case "docx":
    case "xlsx":
    case "pptx":
      return inspectOoxml(buf, kind);
  }
}

export function sha256Hex(buf: Uint8Array): string {
  return createHash("sha256").update(buf).digest("hex");
}
