/**
 * Low-level helpers for the hand-written PDFs (tickets, certificates). No PDF library is
 * installed: pages use the 14 standard fonts (not embedded) with WinAnsiEncoding, so all
 * text has to be WinAnsi bytes.
 */

// WinAnsiEncoding code points outside Latin-1 (cp1252's 0x80-0x9F block)
const WIN_ANSI: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87,
  0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91,
  0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98,
  0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
}

/** Text as WinAnsi bytes; characters the standard fonts can't show become "?". */
export function winAnsiBytes(text: string): number[] {
  const out: number[] = []
  for (const ch of text.replace(/₹\s?/g, "Rs. ")) {
    const c = ch.codePointAt(0)!
    if (c === 0x09 || c === 0x0a || c === 0x0d || c === 0x00a0 || c === 0x2009 || c === 0x202f) out.push(0x20)
    else if ((c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff)) out.push(c)
    else if (WIN_ANSI[c]) out.push(WIN_ANSI[c])
    else out.push(0x3f)
  }
  return out
}

// Look-alikes for characters WinAnsi lacks (applied before winAnsiBytes by winAnsiSafe).
const LOOKALIKE: Record<number, string> = {
  0x2010: "-", 0x2011: "-", 0x2012: "-", 0x2015: "—", 0x2212: "-", // hyphens, bar, minus
  0x201b: "'", 0x2032: "'", 0x201f: "\"", 0x2033: "\"", // reversed quotes, primes
  0x0131: "i", 0x0141: "L", 0x0142: "l", 0x0110: "D", 0x0111: "d", 0x0126: "H", 0x0127: "h", // no NFD form
  0x2192: "->", 0x2190: "<-", 0x2264: "<=", 0x2265: ">=", 0x2260: "!=",
  0x00ad: "", 0x200b: "", 0x200c: "", 0x200d: "", 0xfeff: "", // soft hyphen, zero-width
}

/**
 * Unicode text reduced to what WinAnsi can show: look-alikes for dashes, primes and arrows,
 * accented Latin letters outside Latin-1 (ā, ś, ṇ, ő ...) without their accents, ₹ as "Rs.";
 * winAnsiBytes then turns anything left over into "?".
 */
export function winAnsiSafe(text: string): string {
  let out = ""
  for (const ch of text.replace(/₹\s?/g, "Rs. ")) {
    const c = ch.codePointAt(0)!
    if (LOOKALIKE[c] !== undefined) out += LOOKALIKE[c]
    else if ((c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff) || WIN_ANSI[c]) out += ch
    else if (/\s/.test(ch)) out += " "
    else {
      // strip combining marks: "ā" -> "a"; keep the result only if it is now representable
      const base = ch.normalize("NFD").replace(/\p{M}/gu, "")
      out += base && base !== ch && [...base].every((b) => winAnsiBytes(b)[0] !== 0x3f) ? base : "?"
    }
  }
  return out
}

/** A PDF hex string: no escaping issues with brackets or backslashes in user text. */
export const pdfHexText = (text: string) => `<${winAnsiBytes(text).map((b) => b.toString(16).padStart(2, "0")).join("")}>`

/**
 * A PDF literal string "(...)" of the text's WinAnsi bytes: "(", ")" and "\" escaped,
 * bytes outside printable ASCII as octal escapes, so the file stays 7-bit.
 */
export function pdfLiteralText(text: string): string {
  let out = "("
  for (const b of winAnsiBytes(text)) {
    if (b === 0x28 || b === 0x29 || b === 0x5c) out += `\\${String.fromCharCode(b)}`
    else if (b >= 0x20 && b <= 0x7e) out += String.fromCharCode(b)
    else out += `\\${b.toString(8).padStart(3, "0")}`
  }
  return `${out})`
}

/** A number for a content stream, at most two decimals. */
export const pdfNum = (v: number) => (Math.round(v * 100) / 100).toString()

/** "#rrggbb" (or "#rgb") as the three 0-1 operands of rg/RG. */
export function pdfRgb(hex: string): string {
  let h = hex.replace(/^#/, "")
  if (h.length === 3) h = h.split("").map((c) => c + c).join("")
  const v = parseInt(h, 16)
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((c) => pdfNum(c / 255)).join(" ")
}

/**
 * The whole file from its objects (numbered from 1 in order): object 1 must be the catalog
 * and the last one the document info dictionary. Writes the xref table with byte offsets.
 */
export function assemblePdf(objects: string[]): Buffer {
  let body = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n"
  const offsets: number[] = []
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(body, "latin1"))
    body += `${i + 1} 0 obj\n${obj}\nendobj\n`
  })
  const xrefAt = Buffer.byteLength(body, "latin1")
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  body += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${objects.length} 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`
  return Buffer.from(body, "latin1")
}

/** A content stream object (uncompressed). */
export const pdfStream = (content: string) => `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`

/** A standard Type1 font object with WinAnsiEncoding. */
export const pdfStandardFont = (baseFont: string) => `<< /Type /Font /Subtype /Type1 /BaseFont /${baseFont} /Encoding /WinAnsiEncoding >>`
