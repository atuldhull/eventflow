import QRCode from "qrcode"
import { DEFAULT_CERTIFICATE_DESIGN, type CertificateDesign } from "@/lib/certificate-pdf"
import { bytesWidth, type StandardFont } from "@/lib/pdf-font-metrics"
import {
  assemblePdf, pdfLiteralText, pdfNum as n, pdfRgb as rgb, pdfStandardFont, pdfStream, winAnsiBytes, winAnsiSafe,
} from "@/lib/pdf-writer"

/**
 * The certificate as a one-page A4 PDF file, written directly as PDF 1.4 like the ticket
 * (src/lib/ticket-pdf.ts): standard fonts (Times for the serif design, Helvetica for sans),
 * WinAnsi text, and the verification QR drawn as vector squares. It follows the design the
 * organizer chose: orientation, font family, primary (text) and accent (border) colours.
 *
 * All values are plain text (not HTML-escaped).
 */
export interface CertificatePdfData {
  recipientName: string
  eventTitle: string
  eventDate: string
  organizerName: string
  certificateNumber: string
  verificationCode: string
  /** Defaults to NEXT_PUBLIC_APP_URL/verify/<code>. */
  verificationUrl?: string
  type: string
  title: string
  issuedDate: string
  /** The organizer's body text with its tags filled in; null for the built-in wording. */
  bodyText?: string | null
}

const A4_LONG = 841.89
const A4_SHORT = 595.28

const GREY = "#6b6b6b"
const LIGHT = "#8f8f8f"
const BODY = "#3d3d3d"

type Face = "regular" | "bold" | "italic" | "mono"
const FONT_RES: Record<Face, string> = { regular: "F1", bold: "F2", italic: "F3", mono: "F4" }

function fontsFor(design: CertificateDesign): Record<Face, StandardFont> {
  return design.fontFamily === "sans"
    ? { regular: "Helvetica", bold: "Helvetica-Bold", italic: "Helvetica-Oblique", mono: "Courier-Bold" }
    : { regular: "Times-Roman", bold: "Times-Bold", italic: "Times-Italic", mono: "Courier-Bold" }
}

function verbFor(type: string): string {
  return type === "PARTICIPATION" ? "has successfully participated in"
    : type === "WINNER" ? "has won at"
    : type === "VOLUNTEER" ? "has volunteered at"
    : "has been recognized at"
}

/** Normalised hex (#rgb -> #rrggbb), or the fallback when it isn't a hex colour. */
function hexColor(v: string, fallback: string): string {
  if (!/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) return fallback
  return v.length === 4 ? `#${v.slice(1).split("").map((c) => c + c).join("")}` : v
}

export function renderCertificatePdf(data: CertificatePdfData, design: CertificateDesign | null = null): Buffer {
  const d = design ?? DEFAULT_CERTIFICATE_DESIGN
  const portrait = d.orientation === "portrait"
  const W = portrait ? A4_SHORT : A4_LONG
  const H = portrait ? A4_LONG : A4_SHORT
  const fonts = fontsFor(d)
  const primary = hexColor(d.colors.primary, DEFAULT_CERTIFICATE_DESIGN.colors.primary)
  const accent = hexColor(d.colors.accent, DEFAULT_CERTIFICATE_DESIGN.colors.accent)
  const clean = (s: string) => winAnsiSafe(s).replace(/\s+/g, " ").trim()
  const t = {
    recipientName: clean(data.recipientName) || "Participant",
    eventTitle: clean(data.eventTitle),
    eventDate: clean(data.eventDate),
    organizerName: clean(data.organizerName),
    certificateNumber: clean(data.certificateNumber),
    verificationCode: clean(data.verificationCode),
    title: clean(data.title) || "Certificate",
    issuedDate: clean(data.issuedDate),
    body: data.bodyText ? clean(data.bodyText) : null,
  }
  const verificationUrl = data.verificationUrl
    ?? `${process.env.NEXT_PUBLIC_APP_URL || "https://eventflow.com"}/verify/${encodeURIComponent(data.verificationCode)}`

  const ops: string[] = []
  const width = (face: Face, size: number, s: string, tc = 0) => bytesWidth(fonts[face], winAnsiBytes(s), size, tc)
  const draw = (face: Face, size: number, x: number, y: number, s: string, color: string, tc = 0) =>
    ops.push(`BT ${rgb(color)} rg /${FONT_RES[face]} ${n(size)} Tf ${n(tc)} Tc ${n(x)} ${n(y)} Td ${pdfLiteralText(s)} Tj ET`)
  // Tc is added after every glyph, the last one too; centre on the visible ink
  const centred = (face: Face, size: number, cx: number, y: number, s: string, color: string, tc = 0) =>
    draw(face, size, cx - (width(face, size, s, tc) - tc) / 2, y, s, color, tc)
  const rightAligned = (face: Face, size: number, right: number, y: number, s: string, color: string) =>
    draw(face, size, right - width(face, size, s), y, s, color)

  /** Lines no wider than maxWidth; overlong words are broken; the last kept line ends in "..." if cut. */
  const wrap = (face: Face, size: number, s: string, maxWidth: number, maxLines: number): string[] => {
    const fits = (x: string) => width(face, size, x) <= maxWidth
    const words: string[] = []
    for (const word of s.split(" ").filter(Boolean)) {
      let rest = word
      while (!fits(rest)) {
        let cut = rest.length - 1
        while (cut > 1 && !fits(rest.slice(0, cut))) cut--
        words.push(rest.slice(0, cut))
        rest = rest.slice(cut)
      }
      words.push(rest)
    }
    const lines: string[] = []
    let line = ""
    for (const word of words) {
      const next = line ? `${line} ${word}` : word
      if (fits(next) || !line) line = next
      else {
        lines.push(line)
        line = word
      }
    }
    if (line) lines.push(line)
    if (lines.length <= maxLines) return lines
    const kept = lines.slice(0, maxLines)
    let last = kept[maxLines - 1]
    while (last.length > 1 && !fits(`${last}...`)) last = last.slice(0, -1)
    kept[maxLines - 1] = `${last.replace(/[\s,;:.-]+$/, "")}...`
    return kept
  }

  /** One line at the largest size from max down to min that fits; else wrapped at min. */
  const fitText = (face: Face, max: number, min: number, s: string, maxWidth: number, maxLines: number, tc = 0) => {
    for (let size = max; size >= min; size -= 1) {
      if (width(face, size, s, tc * (size / max)) <= maxWidth) return { size, tc: tc * (size / max), lines: [s] }
    }
    return { size: min, tc: tc * (min / max), lines: wrap(face, min, s, maxWidth, maxLines) }
  }

  // ---- frame: a double border in the accent colour with diamonds at the inner corners ----
  const outer = 18
  const inner = 26
  ops.push(`${rgb(accent)} RG 2.5 w ${n(outer)} ${n(outer)} ${n(W - 2 * outer)} ${n(H - 2 * outer)} re S`)
  ops.push(`${rgb(accent)} RG 0.75 w ${n(inner)} ${n(inner)} ${n(W - 2 * inner)} ${n(H - 2 * inner)} re S`)
  const diamond = (cx: number, cy: number, r: number) =>
    ops.push(`${rgb(accent)} rg ${n(cx)} ${n(cy + r)} m ${n(cx + r)} ${n(cy)} l ${n(cx)} ${n(cy - r)} l ${n(cx - r)} ${n(cy)} l h f`)
  for (const [cx, cy] of [[inner, inner], [W - inner, inner], [inner, H - inner], [W - inner, H - inner]]) diamond(cx, cy, 5)

  const cx = W / 2
  const left = 64
  const right = W - 64
  const contentW = right - left

  // ---- footer: certificate number (left), verification QR with code and URL (right) ----
  const qrSize = 62
  const qrX = right - qrSize
  const qrY = 70
  const qr = QRCode.create(verificationUrl, { errorCorrectionLevel: "M" })
  const modules = qr.modules.size
  const cell = qrSize / modules
  const cells: string[] = []
  for (let row = 0; row < modules; row++) {
    for (let col = 0; col < modules; col++) {
      if (qr.modules.data[row * modules + col]) {
        cells.push(`${n(qrX + col * cell)} ${n(qrY + qrSize - (row + 1) * cell)} ${n(cell + 0.01)} ${n(cell + 0.01)} re`)
      }
    }
  }
  ops.push(`0 0 0 rg ${cells.join(" ")} f`)
  rightAligned("regular", 6.5, qrX - 12, qrY + qrSize - 8, "SCAN TO VERIFY", LIGHT)
  const urlMax = Math.min(300, contentW / 2)
  let urlSize = 7
  while (urlSize > 5 && width("regular", urlSize, verificationUrl) > urlMax) urlSize -= 0.5
  const shownUrl = wrap("regular", urlSize, verificationUrl, urlMax, 1)[0] ?? ""
  rightAligned("mono", 8, right, qrY - 12, t.verificationCode, primary)
  rightAligned("regular", urlSize, right, qrY - 22, shownUrl, GREY)

  draw("regular", 6.5, left, qrY + 12, "CERTIFICATE NO.", LIGHT, 1)
  draw("mono", 9.5, left, qrY - 1, wrap("mono", 9.5, t.certificateNumber, contentW / 2 - 90, 1)[0] ?? "", primary)

  // ---- details: organizer and date of issue above signature-style rules ----
  const colW = portrait ? 180 : 170
  const colGap = portrait ? 36 : 50
  const detailCols = [
    { label: "ORGANIZER", value: t.organizerName || "EventFlow" },
    { label: "DATE OF ISSUE", value: t.issuedDate },
  ]
  // landscape: in the footer band between the number and the QR; portrait: above the footer
  const detailsTop = portrait ? 200 : qrY + 40
  const drawDetails = (topY: number) => {
    detailCols.forEach((col, i) => {
      const colCx = cx + (i === 0 ? -1 : 1) * (colW + colGap) / 2
      const lines = wrap("regular", 11, col.value, colW, 2)
      let y = topY - 13
      for (const line of lines) {
        centred("regular", 11, colCx, y, line, "#2f2f2f")
        y -= 13
      }
      ops.push(`${rgb("#a6a6a6")} RG 0.6 w ${n(colCx - colW / 2)} ${n(y + 7)} m ${n(colCx + colW / 2)} ${n(y + 7)} l S`)
      centred("regular", 7, colCx, y - 4, col.label, LIGHT, 1.2)
    })
  }
  drawDetails(detailsTop)

  // ---- main stack, top to bottom, centred in the space above the footer ----
  type Block = { height: number; draw: (top: number) => void }
  const blocks: Block[] = []
  const gap = (h: number) => blocks.push({ height: h, draw: () => {} })
  const textLines = (face: Face, size: number, lines: string[], color: string, leading: number, tc = 0) =>
    blocks.push({
      height: size + (lines.length - 1) * leading,
      draw: (top) => lines.forEach((line, i) => centred(face, size, cx, top - size * 0.8 - i * leading, line, color, tc)),
    })

  const stackTop = H - inner - 40
  const stackBottom = (portrait ? detailsTop : qrY + qrSize) + 22

  textLines("regular", 9, ["EVENTFLOW"], LIGHT, 0, 3.5)
  gap(portrait ? 30 : 22)
  const title = fitText("regular", portrait ? 30 : 34, 20, t.title, contentW - 40, 2, 1.2)
  textLines("regular", title.size, title.lines, primary, title.size * 1.15, title.tc)
  gap(12)
  blocks.push({
    height: 8,
    draw: (top) => {
      const y = top - 4
      ops.push(`${rgb(accent)} RG 0.75 w ${n(cx - 70)} ${n(y)} m ${n(cx - 10)} ${n(y)} l S ${n(cx + 10)} ${n(y)} m ${n(cx + 70)} ${n(y)} l S`)
      diamond(cx, y, 4)
    },
  })
  gap(portrait ? 30 : 20)
  textLines("italic", 14, ["This certifies that"], GREY, 0)
  gap(portrait ? 22 : 16)
  const name = fitText("bold", portrait ? 34 : 40, 22, t.recipientName, contentW - 40, 2)
  const nameWidest = Math.max(...name.lines.map((l) => width("bold", name.size, l)))
  blocks.push({
    height: name.size + (name.lines.length - 1) * name.size * 1.15 + 12,
    draw: (top) => {
      name.lines.forEach((line, i) => centred("bold", name.size, cx, top - name.size * 0.8 - i * name.size * 1.15, line, primary))
      const lineY = top - name.size - (name.lines.length - 1) * name.size * 1.15 - 6
      const half = Math.min(Math.max(nameWidest + 40, 240), contentW - 40) / 2
      ops.push(`${rgb(accent)} RG 1.25 w ${n(cx - half)} ${n(lineY)} m ${n(cx + half)} ${n(lineY)} l S`)
    },
  })
  gap(portrait ? 24 : 18)

  // body: the organizer's text, or "<verb>" + event title; then the event (and its date)
  // unless the text already names it
  const bodyW = portrait ? 420 : 560
  const bodySize = 12.5
  const leading = 19
  const lower = (s: string) => s.toLowerCase()
  const showEvent = !t.body || !lower(t.body).includes(lower(t.eventTitle))
  const showDate = !t.body || !lower(t.body).includes(lower(t.eventDate))
  const eventLines = showEvent ? wrap("bold", 17, t.eventTitle, bodyW, 2) : []
  const fixed = blocks.reduce((h, b) => h + b.height, 0)
    + (eventLines.length ? 10 + 17 + (eventLines.length - 1) * 21 : 0)
    + (showDate && t.eventDate ? 8 + 12 : 0)
  const roomLines = Math.floor((stackTop - stackBottom - fixed - bodySize) / leading) + 1
  const bodyLines = wrap("regular", bodySize, t.body ?? verbFor(data.type), bodyW, Math.max(1, Math.min(portrait ? 10 : 8, roomLines)))
  textLines("regular", bodySize, bodyLines, BODY, leading)
  if (eventLines.length) {
    gap(10)
    textLines("bold", 17, eventLines, primary, 21)
  }
  if (showDate && t.eventDate) {
    gap(8)
    textLines("italic", 12, [`held on ${t.eventDate}`], GREY, 0)
  }

  const total = blocks.reduce((h, b) => h + b.height, 0)
  // a little above centre reads better than dead centre
  let top = stackTop - Math.max(0, (stackTop - stackBottom - total) * 0.45)
  for (const block of blocks) {
    block.draw(top)
    top -= block.height
  }

  const stream = ops.join("\n")
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${n(W)} ${n(H)}] /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R /F4 7 0 R >> >> /Contents 8 0 R >>`,
    pdfStandardFont(fonts.regular),
    pdfStandardFont(fonts.bold),
    pdfStandardFont(fonts.italic),
    pdfStandardFont(fonts.mono),
    pdfStream(stream),
    `<< /Producer (EventFlow) /Title ${pdfLiteralText(`${t.title} - ${t.recipientName}`)} /Subject ${pdfLiteralText(`Certificate ${t.certificateNumber}`)} >>`,
  ]
  return assemblePdf(objects)
}
