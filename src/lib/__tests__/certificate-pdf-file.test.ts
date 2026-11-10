import { describe, it, expect } from "vitest"
import { renderCertificatePdf, type CertificatePdfData } from "@/lib/certificate-pdf-file"
import type { CertificateDesign } from "@/lib/certificate-pdf"
import { pdfLiteralText, winAnsiBytes, winAnsiSafe } from "@/lib/pdf-writer"
import { bytesWidth, glyphWidth } from "@/lib/pdf-font-metrics"

const data = (o: Partial<CertificatePdfData> = {}): CertificatePdfData => ({
  recipientName: "Asha Verma",
  eventTitle: "Demo Day",
  eventDate: "30 October 2026",
  organizerName: "Tech Club",
  certificateNumber: "CERT-ABC123",
  verificationCode: "VER-XYZ",
  verificationUrl: "https://eventflow.test/verify/VER-XYZ",
  type: "PARTICIPATION",
  title: "Certificate of Participation",
  issuedDate: "1 November 2026",
  ...o,
})
const design = (o: Partial<CertificateDesign> = {}): CertificateDesign => ({
  orientation: "landscape", titleText: null, bodyText: null, fontFamily: "serif",
  colors: { primary: "#112233", accent: "#c9a96e" }, ...o,
})
const text = (pdf: Buffer) => pdf.toString("latin1")

/** Every xref entry points at "N 0 obj", and startxref points at the xref table. */
function checkXref(pdf: Buffer) {
  const s = text(pdf)
  const startxref = Number(/startxref\n(\d+)\n%%EOF\n$/.exec(s)![1])
  expect(s.slice(startxref, startxref + 5)).toBe("xref\n")
  const [, first, count] = /^xref\n(\d+) (\d+)\n/.exec(s.slice(startxref))!
  expect(first).toBe("0")
  const entries = s.slice(startxref).split("\n").slice(2, 2 + Number(count))
  expect(entries[0]).toBe("0000000000 65535 f ")
  entries.slice(1).forEach((entry, i) => {
    expect(entry).toMatch(/^\d{10} 00000 n $/)
    const offset = Number(entry.slice(0, 10))
    expect(s.slice(offset, offset + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`)
  })
  expect(s).toContain(`/Size ${count}`)
  // the content stream's /Length is its byte length
  const m = /\/Length (\d+) >>\nstream\n/.exec(s)!
  const start = m.index + m[0].length
  expect(s.slice(start + Number(m[1]), start + Number(m[1]) + 10)).toBe("\nendstream")
}

describe("renderCertificatePdf", () => {
  it("writes a valid PDF 1.4 file with correct xref offsets", () => {
    const pdf = renderCertificatePdf(data(), design())
    expect(text(pdf).startsWith("%PDF-1.4\n")).toBe(true)
    expect(text(pdf).endsWith("%%EOF\n")).toBe(true)
    checkXref(pdf)
    expect(pdf.length).toBeGreaterThan(1000)
  })

  it("shows the recipient, title, event, organizer, dates, number and verification code", () => {
    const s = text(renderCertificatePdf(data(), design()))
    for (const v of ["Asha Verma", "Certificate of Participation", "This certifies that", "has successfully participated in",
      "Demo Day", "held on 30 October 2026", "Tech Club", "1 November 2026", "CERT-ABC123", "VER-XYZ",
      "https://eventflow.test/verify/VER-XYZ", "ORGANIZER", "DATE OF ISSUE"]) {
      expect(s).toContain(`(${v})`)
    }
  })

  it("landscape and portrait A4", () => {
    expect(text(renderCertificatePdf(data(), design()))).toContain("/MediaBox [0 0 841.89 595.28]")
    expect(text(renderCertificatePdf(data(), design({ orientation: "portrait" })))).toContain("/MediaBox [0 0 595.28 841.89]")
    expect(text(renderCertificatePdf(data(), null))).toContain("/MediaBox [0 0 841.89 595.28]")
  })

  it("serif uses Times, sans uses Helvetica", () => {
    const serif = text(renderCertificatePdf(data(), design()))
    expect(serif).toContain("/BaseFont /Times-Roman")
    expect(serif).toContain("/BaseFont /Times-Bold")
    expect(serif).not.toContain("/BaseFont /Helvetica")
    const sans = text(renderCertificatePdf(data(), design({ fontFamily: "sans" })))
    expect(sans).toContain("/BaseFont /Helvetica-Bold")
    expect(sans).not.toContain("/BaseFont /Times")
  })

  it("draws text in the primary colour and the border in the accent colour", () => {
    const s = text(renderCertificatePdf(data(), design({ colors: { primary: "#ff0000", accent: "#00f" } })))
    expect(s).toContain("1 0 0 rg /F2") // name in bold, primary
    expect(s).toMatch(/0 0 1 RG 2\.5 w 18 18 /) // outer border, accent (#00f expanded)
  })

  it("escapes parentheses and backslashes in text", () => {
    const s = text(renderCertificatePdf(data({ recipientName: "A (B) \\ C" }), design()))
    expect(s).toContain("(A \\(B\\) \\\\ C)")
    expect(pdfLiteralText("x(y)z\\")).toBe("(x\\(y\\)z\\\\)")
  })

  it("maps Unicode to WinAnsi: quotes, dashes, rupee, accents; anything else is ?", () => {
    expect(winAnsiSafe("“Ā” — ₹500 – Łódź ‑ 漢")).toBe("“A” — Rs. 500 – Lódz - ?")
    expect(pdfLiteralText("é “x”")).toBe("(\\351 \\223x\\224)")
    const s = text(renderCertificatePdf(data({ recipientName: "Śrī Ānanda 李" }), design()))
    expect(s).toContain("(Sri Ananda ?)")
    // the file stays 7-bit apart from the binary marker on line 2
    expect(/[\x80-\xff]/.test(s.split("\n").slice(2).join("\n"))).toBe(false)
  })

  it("custom body: wrapped, and the event line only when the text doesn't name the event", () => {
    const body = "For outstanding work during Demo Day on 30 October 2026. ".repeat(3).trim()
    const s = text(renderCertificatePdf(data({ bodyText: body }), design()))
    expect(s).not.toContain("(Demo Day)")
    expect(s).not.toContain("held on")
    const other = text(renderCertificatePdf(data({ bodyText: "For outstanding work." }), design()))
    expect(other).toContain("(Demo Day)")
    expect(other).toContain("(held on 30 October 2026)")
  })

  it("long names shrink or wrap and long bodies are cut with an ellipsis, inside the page", () => {
    const pdf = renderCertificatePdf(data({ recipientName: "Venkataramanan Subrahmanyam Chandrasekharan Iyer Ramaswamy Krishnamurthy", bodyText: "word ".repeat(600) }), design({ orientation: "portrait" }))
    checkXref(pdf)
    const s = text(pdf)
    expect(s).toMatch(/\.\.\.\) Tj/)
    // every text position stays inside the inner border
    for (const m of s.matchAll(/ (-?[\d.]+) (-?[\d.]+) Td /g)) {
      const [x, y] = [Number(m[1]), Number(m[2])]
      expect(x).toBeGreaterThan(26)
      expect(x).toBeLessThan(595.28 - 26)
      expect(y).toBeGreaterThan(26)
      expect(y).toBeLessThan(841.89 - 26)
    }
  })
})

describe("pdf font metrics", () => {
  it("has a width for every printable ASCII character and uses base letters for accents", () => {
    for (const font of ["Helvetica", "Helvetica-Bold", "Times-Roman", "Times-Bold", "Times-Italic"] as const) {
      for (let b = 0x20; b <= 0x7e; b++) expect(glyphWidth(font, b)).toBeGreaterThan(0)
      expect(glyphWidth(font, 0xe9)).toBe(glyphWidth(font, 0x65)) // é = e
    }
    expect(bytesWidth("Helvetica", winAnsiBytes("Hello"), 10)).toBeCloseTo(((722 + 556 + 222 + 222 + 556) / 1000) * 10)
    expect(bytesWidth("Courier-Bold", winAnsiBytes("ABC"), 10)).toBe(18)
  })
})
