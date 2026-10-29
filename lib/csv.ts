// CSV export for admin tables. RFC 4180 quoting, so commas and line breaks in addresses stay in
// one cell. Customer-typed text that starts like a spreadsheet formula (=, +, @, - followed by a
// non-digit) gets a leading apostrophe, so opening the file in Excel never runs it.

const FORMULA_START = /^(?:[=+@\t\r]|-(?!\d))/;

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  let text = String(value);
  if (typeof value === "string" && FORMULA_START.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv(rows: unknown[][]): string {
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

/** Downloads the rows (header first) as `<name>-YYYY-MM-DD.csv`. */
export function downloadCsv(name: string, rows: unknown[][]) {
  // BOM so Excel reads ₱ and ñ correctly.
  const blob = new Blob(["﻿" + toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
