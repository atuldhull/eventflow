import QRCode from "qrcode"
import { ticketPlace } from "@/lib/ticket-place"
import { assemblePdf, pdfHexText as pdfText, pdfNum, pdfRgb, winAnsiBytes } from "@/lib/pdf-writer"

export { winAnsiBytes }

/**
 * A one-page A4 PDF ticket, written directly as PDF 1.4 (no PDF library is installed):
 * the standard Helvetica/Courier fonts (not embedded, WinAnsi text) and the QR code drawn
 * as vector squares on a white box, so door scanners read it on screen or on paper.
 */
export interface TicketPdfData {
  eventTitle: string
  when: string
  place: string
  organizer?: string | null
  participant: string
  ticketType: string
  price: string
  ticketNumber: string
  registrationNumber: string
  status: string
  qrPayload: string
}

/** What the ticket PDF routes read (prisma `select`). */
export const TICKET_PDF_SELECT = {
  id: true, userId: true, ticketNumber: true, qrCode: true, status: true, metadata: true,
  event: {
    select: {
      slug: true, title: true, startDate: true, endDate: true, timezone: true, venue: true, venueCity: true,
      isOnline: true, type: true, organization: { select: { name: true } },
    },
  },
  ticketType: { select: { name: true, price: true, currency: true } },
  registration: { select: { registrationNumber: true } },
  user: { select: { name: true } },
} as const

export interface TicketForPdf {
  ticketNumber: string
  qrCode: string
  status: string
  event: {
    title: string; startDate: Date; endDate: Date; timezone: string | null
    venue: string | null; venueCity: string | null; isOnline: boolean; type: string | null
    organization: { name: string } | null
  }
  ticketType: { name: string; price: unknown; currency: string | null }
  registration: { registrationNumber: string }
  user: { name: string | null }
}

/** Tickets that no longer admit get no PDF. */
export const PDF_BLOCKED_STATUSES = ["CANCELLED", "TRANSFERRED", "EXPIRED"]

const STATUS_TEXT: Record<string, string> = { ACTIVE: "Valid", USED: "Checked in" }

export function ticketPdfData(ticket: TicketForPdf): TicketPdfData {
  const tz = ticket.event.timezone || "Asia/Kolkata"
  const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) => {
    try {
      return d.toLocaleString("en-IN", { ...opts, timeZone: tz })
    } catch {
      return d.toLocaleString("en-IN", opts)
    }
  }
  const price = Number(ticket.ticketType.price)
  const currency = ticket.ticketType.currency || "INR"
  return {
    eventTitle: ticket.event.title,
    when: `${fmt(ticket.event.startDate, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}, ${fmt(ticket.event.startDate, { hour: "numeric", minute: "2-digit" })}`,
    place: ticketPlace(ticket.event, ticket.ticketType.name).label,
    organizer: ticket.event.organization?.name ?? null,
    participant: ticket.user.name || "Participant",
    ticketType: ticket.ticketType.name,
    price: price > 0 ? `${currency === "INR" ? "Rs." : currency} ${price.toLocaleString("en-IN", { maximumFractionDigits: 2 })}` : "Free",
    ticketNumber: ticket.ticketNumber,
    registrationNumber: ticket.registration.registrationNumber,
    status: STATUS_TEXT[ticket.status] ?? ticket.status,
    qrPayload: ticket.qrCode,
  }
}

const PAGE_W = 595.28
const PAGE_H = 841.89

// Rough Helvetica advance widths (em), enough to wrap and truncate lines.
function textWidth(text: string, size: number): number {
  let em = 0
  for (const ch of text) {
    em += /[ilIj.,:;'|!]/.test(ch) ? 0.28 : /[ ftr()\-/]/.test(ch) ? 0.34 : /[mwMW@]/.test(ch) ? 0.86 : /[A-Z0-9#&%?]/.test(ch) ? 0.68 : 0.56
  }
  return em * size
}

/** Up to `maxLines` lines no wider than `maxWidth`; the last one ends in "..." if cut. */
export function wrapText(text: string, size: number, maxWidth: number, maxLines: number): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean)
  const lines: string[] = []
  let line = ""
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (textWidth(next, size) <= maxWidth || !line) {
      line = next
    } else {
      lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  const fit = (s: string) => {
    let out = s
    while (out.length > 1 && textWidth(`${out}...`, size) > maxWidth) out = out.slice(0, -1)
    return out === s ? s : `${out.trimEnd()}...`
  }
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines)
    kept[maxLines - 1] = fit(`${kept[maxLines - 1]} ${lines.slice(maxLines).join(" ")}`)
    if (!kept[maxLines - 1].endsWith("...")) kept[maxLines - 1] = `${kept[maxLines - 1]}...`
    return kept
  }
  return lines.map(fit)
}

const n = pdfNum
const rgb = pdfRgb

export function buildTicketPdf(data: TicketPdfData): Buffer {
  const ops: string[] = []
  const text = (font: "F1" | "F2" | "F3", size: number, x: number, y: number, value: string, color = "#171717") =>
    ops.push(`BT ${rgb(color)} rg /${font} ${size} Tf ${n(x)} ${n(y)} Td ${pdfText(value)} Tj ET`)
  const rect = (x: number, y: number, w: number, h: number, fill: string) => ops.push(`${rgb(fill)} rg ${n(x)} ${n(y)} ${n(w)} ${n(h)} re f`)

  const left = 48
  const width = PAGE_W - 2 * left
  const top = PAGE_H - 48

  // Card outline and header band
  ops.push(`${rgb("#d9dce3")} RG 1 w ${n(left)} ${n(top - 430)} ${n(width)} 430 re S`)
  rect(left, top - 128, width, 128, "#171717")
  const titleLines = wrapText(data.eventTitle, 20, width - 48, 2)
  let y = top - 44
  for (const line of titleLines) {
    text("F2", 20, left + 24, y, line, "#ffffff")
    y -= 25
  }
  text("F1", 11, left + 24, top - 104, wrapText(data.when, 11, width - 48, 1)[0] ?? "", "#c9cdd6")
  if (data.organizer) text("F1", 9, left + 24, top - 119, wrapText(`Organized by ${data.organizer}`, 9, width - 48, 1)[0] ?? "", "#9aa1ae")

  // Details (left)
  const rows: [string, string][] = [
    ["Participant", data.participant],
    ["Ticket", data.ticketType],
    ["Price", data.price],
    ["Where", data.place],
    ["Registration #", data.registrationNumber],
    ["Status", data.status],
  ]
  const colWidth = 250
  y = top - 162
  for (const [label, value] of rows) {
    text("F1", 9, left + 24, y, label, "#6b7280")
    const lines = wrapText(value || "-", 12, colWidth, 2)
    lines.forEach((line, i) => text("F1", 12, left + 24, y - 15 - i * 14, line))
    y -= 32 + (lines.length - 1) * 14
  }

  // Perforation between details and the QR stub
  const stubX = left + colWidth + 44
  ops.push(`${rgb("#c3c7cf")} RG 1 w [4 3] 0 d ${n(stubX)} ${n(top - 140)} m ${n(stubX)} ${n(top - 418)} l S [] 0 d`)

  // QR on white, with the ticket number under it
  const qr = QRCode.create(data.qrPayload, { errorCorrectionLevel: "M" })
  const size = qr.modules.size
  const qrBox = 184
  const boxX = stubX + (PAGE_W - left - stubX - qrBox) / 2
  const boxY = top - 150 - qrBox
  rect(boxX, boxY, qrBox, qrBox, "#ffffff")
  ops.push(`${rgb("#d9dce3")} RG 0.75 w ${n(boxX)} ${n(boxY)} ${n(qrBox)} ${n(qrBox)} re S`)
  const quiet = 4
  const cell = qrBox / (size + 2 * quiet)
  const cells: string[] = []
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (qr.modules.data[row * size + col]) {
        cells.push(`${n(boxX + (col + quiet) * cell)} ${n(boxY + qrBox - (row + quiet + 1) * cell)} ${n(cell + 0.01)} ${n(cell + 0.01)} re`)
      }
    }
  }
  ops.push(`0 0 0 rg ${cells.join(" ")} f`)
  const numberWidth = data.ticketNumber.length * 0.6 * 13
  text("F3", 13, boxX + (qrBox - numberWidth) / 2, boxY - 22, data.ticketNumber)
  text("F1", 9, boxX + (qrBox - textWidth("Show this code at the entrance", 9)) / 2, boxY - 38, "Show this code at the entrance", "#6b7280")

  text("F1", 9, left + 24, top - 412, "Present this ticket (QR code or ticket number) at the event entrance. Powered by EventFlow.", "#6b7280")

  const stream = ops.join("\n")
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R >> >> /Contents 7 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>",
    `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`,
    `<< /Producer (EventFlow) /Title ${pdfText(`Ticket ${data.ticketNumber}`)} >>`,
  ]

  return assemblePdf(objects)
}
