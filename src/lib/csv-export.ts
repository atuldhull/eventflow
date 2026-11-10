/**
 * CSV building for admin exports. Every cell is quoted, and any cell a spreadsheet would
 * read as a formula (=, +, -, @, tab, carriage return at the start) is prefixed with a
 * single quote so opening the file can never run a formula (CSV/formula injection).
 */

const FORMULA_START = /^[=+\-@\t\r]/

export type CsvValue = string | number | boolean | Date | null | undefined

/** One CSV cell: neutralised against formula injection, then quoted. */
export function csvCell(value: CsvValue): string {
  let text: string
  if (value === null || value === undefined) text = ""
  else if (value instanceof Date) text = Number.isNaN(value.getTime()) ? "" : value.toISOString()
  else text = String(value)

  // Plain numbers (e.g. -12.5) are data, not formulas; everything else starting with a
  // trigger character is defused.
  if (typeof value !== "number" && FORMULA_START.test(text)) text = `'${text}`

  return `"${text.replace(/"/g, '""')}"`
}

/** A whole CSV document (header row first), CRLF-separated as RFC 4180 suggests. */
export function toCsv(headers: string[], rows: CsvValue[][]): string {
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")
}

/** A download response for a CSV body. The filename is reduced to safe characters. */
export function csvResponse(filename: string, csv: string): Response {
  const safe = filename.replace(/[^A-Za-z0-9._-]/g, "_")
  // A BOM so Excel reads UTF-8 names correctly.
  return new Response(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safe}"`,
      "Cache-Control": "no-store",
    },
  })
}

/** Today's date as YYYY-MM-DD, for export file names. */
export function exportDateStamp(now = new Date()): string {
  return now.toISOString().slice(0, 10)
}
