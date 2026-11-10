/*
 * Turning a pasted list or an uploaded .csv into the addresses to invite (client side; the
 * invite API validates every address again).
 */

/** How many addresses one invite request takes (POST /api/members/invite, `emails`). */
export const MAX_INVITE_EMAILS = 50

const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/

/**
 * Splits pasted text (commas, semicolons, spaces or new lines; "Name <a@b.c>" works too)
 * into unique lowercased addresses, and the entries that aren't addresses.
 */
export function parseEmailList(text: string): { emails: string[]; invalid: string[] } {
  const parts = text
    // "Asha Rao <asha@x.edu>" (copied from a mail client): just the address
    .replace(/[^,;\n<>]*<([^<>]+)>/g, " $1 ")
    .split(/[\s,;]+/)
    .map((p) => p.trim().replace(/^["'<(]+|[>"')]+$/g, "").toLowerCase())
    .filter(Boolean)
  const unique = Array.from(new Set(parts))
  return { emails: unique.filter((p) => EMAIL.test(p)), invalid: unique.filter((p) => !EMAIL.test(p)) }
}

/** One CSV line into cells (quoted cells may hold commas and doubled quotes). */
function csvCells(line: string, delimiter: string): string[] {
  const cells: string[] = []
  let cell = ""
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cell += '"'; i++ }
      else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === delimiter) { cells.push(cell); cell = "" }
    else cell += ch
  }
  cells.push(cell)
  return cells.map((c) => c.trim())
}

/**
 * The addresses in a .csv file: the column headed "email" (or "e-mail", "email address")
 * when there is one, otherwise the first column. A first row without an "@" in that column
 * is taken as a header and skipped. Semicolon- and tab-separated exports work too.
 */
export function emailsFromCsv(text: string): string[] {
  const lines = (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text).split(/\r\n|\n|\r/).filter((l) => l.trim() !== "")
  if (lines.length === 0) return []
  const first = lines[0]
  const delimiter = first.includes(",") ? "," : first.includes(";") ? ";" : first.includes("\t") ? "\t" : ","
  const rows = lines.map((l) => csvCells(l, delimiter))

  const header = rows[0].map((c) => c.toLowerCase().replace(/[\s_-]+/g, ""))
  const named = header.findIndex((c) => c === "email" || c === "emailaddress" || c === "mail")
  const column = named >= 0 ? named : 0
  const body = named >= 0 || !(rows[0][0] ?? "").includes("@") ? rows.slice(1) : rows
  return body.map((r) => r[column] ?? "").filter(Boolean)
}
