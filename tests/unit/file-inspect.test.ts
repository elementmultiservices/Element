import { describe, expect, it } from "vitest";
import { strToU8, zipSync, zlibSync } from "fflate";
import { inspectFile, sha256Hex } from "@/lib/files/inspect";

const DOCX_MAIN = "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml";
const XLSX_MAIN = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml";

function contentTypes(...overrides: string[]): Uint8Array {
  const parts = overrides.map((ct) => `<Override PartName="/x" ContentType="${ct}"/>`).join("");
  return strToU8(`<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">${parts}</Types>`);
}

function ooxml(files: Record<string, Uint8Array>): Uint8Array {
  return zipSync(files);
}

function concat(...parts: (string | Uint8Array)[]): Uint8Array {
  const buffers = parts.map((p) => (typeof p === "string" ? Buffer.from(p, "latin1") : Buffer.from(p)));
  return new Uint8Array(Buffer.concat(buffers));
}

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
const SIMPLE_PDF = concat("%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF");

describe("inspectFile — signatures", () => {
  it("accepts genuine PNG, JPG and PDF", () => {
    expect(inspectFile(PNG, "png")).toEqual({ ok: true });
    expect(inspectFile(JPG, "jpg")).toEqual({ ok: true });
    expect(inspectFile(SIMPLE_PDF, "pdf")).toEqual({ ok: true });
  });

  it("rejects content that does not match the declared type", () => {
    expect(inspectFile(PNG, "pdf")).toEqual({ ok: false, reason: "signatureMismatch" });
    expect(inspectFile(JPG, "png")).toEqual({ ok: false, reason: "signatureMismatch" });
    // A Windows executable renamed to .pdf / .png
    const exe = concat("MZ\x90\x00\x03\x00\x00\x00");
    expect(inspectFile(exe, "pdf")).toEqual({ ok: false, reason: "signatureMismatch" });
    expect(inspectFile(exe, "png")).toEqual({ ok: false, reason: "signatureMismatch" });
  });
});

describe("inspectFile — PDF active content", () => {
  it("rejects plain-text JavaScript actions", () => {
    const pdf = concat("%PDF-1.4\n1 0 obj << /OpenAction << /S /JavaScript /JS (app.alert(1)) >> >> endobj\n%%EOF");
    expect(inspectFile(pdf, "pdf")).toEqual({ ok: false, reason: "activeContent" });
  });

  it("rejects /JS values even without a /JavaScript name", () => {
    for (const js of ["/JS (app.alert(1))", "/JS<6170702e616c6572742831293e>", "/JS 12 0 R"]) {
      const pdf = concat(`%PDF-1.4\n1 0 obj << /AA << /O << ${js} >> >> >> endobj\n%%EOF`);
      expect(inspectFile(pdf, "pdf")).toEqual({ ok: false, reason: "activeContent" });
    }
  });

  it("ignores /JS bytes that occur by chance inside binary image data", () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0x2f, 0x4a, 0x53, 0xd0, 0xd0, 0x5b, 0x52]); // "/JS" + binary
    const pdf = concat("%PDF-1.4\n1 0 obj << /Filter /DCTDecode /Length 10 >>\nstream\n", jpeg, "\nendstream\nendobj\n%%EOF");
    expect(inspectFile(pdf, "pdf")).toEqual({ ok: true });
  });

  it("rejects /Launch actions", () => {
    const pdf = concat("%PDF-1.4\n1 0 obj << /OpenAction << /S /Launch /F (cmd.exe) >> >> endobj\n%%EOF");
    expect(inspectFile(pdf, "pdf")).toEqual({ ok: false, reason: "activeContent" });
  });

  it("finds JavaScript hidden inside a compressed object stream", () => {
    const hidden = zlibSync(strToU8("<< /S /JavaScript /JS (this.exportDataObject()) >>"));
    const pdf = concat("%PDF-1.5\n4 0 obj << /Type /ObjStm /Filter /FlateDecode /Length ", String(hidden.length), " >>\nstream\n", hidden, "\nendstream\nendobj\n%%EOF");
    expect(inspectFile(pdf, "pdf")).toEqual({ ok: false, reason: "activeContent" });
  });

  it("accepts compressed streams without active content", () => {
    const body = zlibSync(strToU8("BT /F1 12 Tf 72 712 Td (Hello) Tj ET"));
    const pdf = concat("%PDF-1.5\n4 0 obj << /Filter /FlateDecode /Length ", String(body.length), " >>\nstream\n", body, "\nendstream\nendobj\n%%EOF");
    expect(inspectFile(pdf, "pdf")).toEqual({ ok: true });
  });

  it("rejects decompression bombs", () => {
    const bomb = zlibSync(new Uint8Array(60 * 1024 * 1024)); // 60 MB of zeros compresses to ~60 KB
    const pdf = concat("%PDF-1.5\n4 0 obj << /Filter /FlateDecode >>\nstream\n", bomb, "\nendstream\nendobj\n%%EOF");
    expect(inspectFile(pdf, "pdf")).toEqual({ ok: false, reason: "corrupt" });
  });
});

describe("inspectFile — Office documents", () => {
  it("accepts a clean DOCX", () => {
    const docx = ooxml({ "[Content_Types].xml": contentTypes(DOCX_MAIN), "word/document.xml": strToU8("<w:document/>") });
    expect(inspectFile(docx, "docx")).toEqual({ ok: true });
  });

  it("rejects macros (vbaProject.bin)", () => {
    const docm = ooxml({
      "[Content_Types].xml": contentTypes(DOCX_MAIN),
      "word/vbaProject.bin": new Uint8Array([1, 2, 3]),
    });
    expect(inspectFile(docm, "docx")).toEqual({ ok: false, reason: "activeContent" });
  });

  it("rejects macro-enabled content types renamed to .xlsx", () => {
    const xlsm = ooxml({ "[Content_Types].xml": contentTypes("application/vnd.ms-excel.sheet.macroEnabled.main+xml") });
    expect(inspectFile(xlsm, "xlsx")).toEqual({ ok: false, reason: "activeContent" });
  });

  it("rejects embedded executables", () => {
    const docx = ooxml({ "[Content_Types].xml": contentTypes(DOCX_MAIN), "word/media/payload.exe": new Uint8Array([0x4d, 0x5a]) });
    expect(inspectFile(docx, "docx")).toEqual({ ok: false, reason: "activeContent" });
  });

  it("rejects a DOCX declared as XLSX", () => {
    const docx = ooxml({ "[Content_Types].xml": contentTypes(DOCX_MAIN) });
    expect(inspectFile(docx, "xlsx")).toEqual({ ok: false, reason: "signatureMismatch" });
  });

  it("rejects a plain ZIP without Office structure", () => {
    const zip = ooxml({ "readme.txt": strToU8("hello") });
    expect(inspectFile(zip, "docx")).toEqual({ ok: false, reason: "corrupt" });
  });

  it("accepts a clean XLSX", () => {
    const xlsx = ooxml({ "[Content_Types].xml": contentTypes(XLSX_MAIN) });
    expect(inspectFile(xlsx, "xlsx")).toEqual({ ok: true });
  });
});

describe("sha256Hex", () => {
  it("matches a known digest", () => {
    expect(sha256Hex(strToU8("abc"))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});
