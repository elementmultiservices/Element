import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "@/lib/csv";

describe("csvCell", () => {
  it("quotes values and escapes double quotes", () => {
    expect(csvCell('He said "hi"')).toBe('"He said ""hi"""');
    expect(csvCell("a,b;c\nd")).toBe('"a,b;c\nd"');
  });

  it("neutralizes formula injection", () => {
    expect(csvCell("=HYPERLINK(\"http://evil\")")).toBe('"\'=HYPERLINK(""http://evil"")"');
    expect(csvCell("+1+1")).toBe('"\'+1+1"');
    expect(csvCell("-2+3")).toBe('"\'-2+3"');
    expect(csvCell("@SUM(A1)")).toBe('"\'@SUM(A1)"');
    expect(csvCell("\tcmd")).toBe('"\'\tcmd"');
  });

  it("keeps numbers as numbers (negative numbers are not text)", () => {
    expect(csvCell(-5)).toBe('"-5"');
    expect(csvCell(1024)).toBe('"1024"');
  });

  it("renders null and undefined as empty", () => {
    expect(csvCell(null)).toBe('""');
    expect(csvCell(undefined)).toBe('""');
  });
});

describe("toCsv", () => {
  it("adds a BOM, uses the delimiter and CRLF", () => {
    const csv = toCsv(["a", "b"], [[1, "x"]], ";");
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toBe('﻿"a";"b"\r\n"1";"x"\r\n');
  });
});
