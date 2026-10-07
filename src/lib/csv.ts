export type CsvValue = string | number | boolean | null | undefined;

/**
 * Cells starting with these characters are interpreted as formulas by Excel,
 * LibreOffice and Google Sheets (CSV/formula injection). They are prefixed with
 * an apostrophe so the content is shown as text.
 */
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return '""';
  let text = typeof value === "string" ? value : String(value);
  if (typeof value === "string" && FORMULA_PREFIX.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

/**
 * Builds a CSV document with a UTF-8 BOM (so Excel detects the encoding) and
 * CRLF line endings. Spanish spreadsheets expect ";" as the list separator.
 */
export function toCsv(headers: string[], rows: CsvValue[][], delimiter: "," | ";"): string {
  const lines = [headers, ...rows].map((row) => row.map(csvCell).join(delimiter));
  return `﻿${lines.join("\r\n")}\r\n`;
}
