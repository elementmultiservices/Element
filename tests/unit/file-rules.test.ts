import { describe, expect, it } from "vitest";
import { checkFileName, sanitizeDisplayName, sanitizeDownloadName } from "@/lib/files/rules";

describe("checkFileName", () => {
  it.each([
    ["report.pdf", "pdf"],
    ["Informe anual 2026.DOCX", "docx"],
    ["budget.xlsx", "xlsx"],
    ["slides.pptx", "pptx"],
    ["photo.jpeg", "jpg"],
    ["scan.JPG", "jpg"],
    ["logo.png", "png"],
    ["contrato_v2-final.pdf", "pdf"],
  ])("accepts %s", (name, kind) => {
    const result = checkFileName(name);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.kind).toBe(kind);
  });

  it.each(["malware.exe", "script.js", "page.html", "image.svg", "archive.zip", "macro.docm", "macro.xlsm", "noextension", ".pdf"])(
    "rejects disallowed type %s",
    (name) => {
      const result = checkFileName(name);
      expect(result.ok).toBe(false);
    },
  );

  it.each(["invoice.exe.pdf", "photo.php.png", "report.pdf.docx", "file.js.jpg", "x.HTML.pdf"])("rejects double extension %s", (name) => {
    expect(checkFileName(name)).toEqual({ ok: false, reason: "doubleExtension" });
  });

  it.each(["../../etc/passwd.pdf", "folder\\file.pdf", "bad\u0000name.pdf", "trailing.pdf ", "trailing.pdf.", "a".repeat(252) + ".pdf"])(
    "rejects unsafe name %j",
    (name) => {
      expect(checkFileName(name)).toEqual({ ok: false, reason: "invalidName" });
    },
  );
});

describe("sanitizers", () => {
  it("removes bidi overrides used to disguise extensions", () => {
    // "invoice‮fdp.exe" renders as "invoiceexe.pdf" in some UIs.
    expect(sanitizeDisplayName("invoice‮fdp.exe")).toBe("invoicefdp.exe");
  });

  it("strips header-breaking characters from download names", () => {
    const name = sanitizeDownloadName('evil"; filename="x.exe\r\n.pdf');
    expect(name).not.toMatch(/["\r\n;=]/);
  });

  it("never returns an empty download name", () => {
    expect(sanitizeDownloadName("‮")).toBe("file");
  });
});
