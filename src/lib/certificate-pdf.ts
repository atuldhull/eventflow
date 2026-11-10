import QRCode from "qrcode"
import { escapeHtml } from "@/lib/escape-html"

/** Every value is already HTML-escaped by the caller (verificationCode URL-encoded). */
interface CertificateData {
  recipientName: string
  eventTitle: string
  eventDate: string
  organizerName: string
  certificateNumber: string
  verificationCode: string
  type: string
  title: string
  issuedDate: string
}

/**
 * The look an organizer chose in the template builder, which saves its settings as JSON
 * in CertificateTemplate.templateHtml: { type, orientation, titleText, bodyText,
 * fontFamily, colors: { primary, accent } }.
 */
export interface CertificateDesign {
  orientation: "landscape" | "portrait"
  titleText: string | null
  bodyText: string | null
  fontFamily: "serif" | "sans"
  colors: { primary: string; accent: string }
}

export const DEFAULT_CERTIFICATE_DESIGN: CertificateDesign = {
  orientation: "landscape",
  titleText: null,
  bodyText: null,
  fontFamily: "serif",
  colors: { primary: "#1a1a1a", accent: "#c9a96e" },
}

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i
const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null)

/**
 * The design saved with a template, or null when there is none to apply (no template, or
 * not the builder's JSON). Raw organizer HTML is never rendered: only these fields are used,
 * colors must be hex values and the texts are escaped when filled in.
 */
export function certificateDesignFromTemplate(templateHtml: string | null | undefined): CertificateDesign | null {
  if (!templateHtml) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(templateHtml)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null
  const t = parsed as Record<string, unknown>
  const colors = (t.colors && typeof t.colors === "object" ? t.colors : {}) as Record<string, unknown>
  const color = (v: unknown, fallback: string) => (typeof v === "string" && HEX_COLOR.test(v) ? v : fallback)
  return {
    orientation: t.orientation === "portrait" ? "portrait" : "landscape",
    titleText: text(t.titleText, 200),
    bodyText: text(t.bodyText, 2000),
    fontFamily: t.fontFamily === "sans" || t.fontFamily === "sans-serif" ? "sans" : "serif",
    colors: {
      primary: color(colors.primary, DEFAULT_CERTIFICATE_DESIGN.colors.primary),
      accent: color(colors.accent, DEFAULT_CERTIFICATE_DESIGN.colors.accent),
    },
  }
}

/**
 * Organizer text with the builder's tags ({{name}}, {{event_title}}, {{event_date}},
 * {{organizer_name}}, {{certificate_id}}) filled in. The text is escaped first; the values
 * must already be HTML-safe. Unknown tags stay as typed.
 */
export function fillCertificateTags(template: string, safeValues: Record<string, string>): string {
  return escapeHtml(template).replace(/\{\{\s*(\w+)\s*\}\}/g, (tag, key: string) =>
    Object.prototype.hasOwnProperty.call(safeValues, key) ? safeValues[key] : tag
  )
}

/** The same tags filled in plain text (for the PDF, which needs no HTML escaping). */
export function fillCertificateTagsText(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (tag, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? values[key] : tag
  )
}

function defaultBody(data: CertificateData): string {
  const verb =
    data.type === "PARTICIPATION" ? "participated in" :
    data.type === "WINNER" ? "won at" :
    data.type === "VOLUNTEER" ? "volunteered at" : "been recognized at"
  return `has successfully ${verb} <span class="event-title">${data.eventTitle}</span>, organized by ${data.organizerName} on ${data.eventDate}.`
}

export async function generateCertificateHTML(data: CertificateData, design: CertificateDesign | null = null): Promise<string> {
  const d = design ?? DEFAULT_CERTIFICATE_DESIGN
  const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://eventflow.com"}/verify/${data.verificationCode}`
  let qrDataUrl = ""
  try {
    qrDataUrl = await QRCode.toDataURL(verificationUrl, { width: 100, margin: 1 })
  } catch {}

  const tags = {
    name: data.recipientName,
    event_title: data.eventTitle,
    event_date: data.eventDate,
    organizer_name: data.organizerName,
    certificate_id: data.certificateNumber,
  }
  const title = data.title
  const body = d.bodyText ? fillCertificateTags(d.bodyText, tags) : defaultBody(data)
  const portrait = d.orientation === "portrait"
  const [width, height] = portrait ? ["210mm", "297mm"] : ["297mm", "210mm"]
  const font = d.fontFamily === "sans"
    ? "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif"
    : "'Georgia', 'Times New Roman', serif"
  const { primary, accent } = d.colors

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${title}</title>
<style>
@page { size: A4 ${portrait ? "portrait" : "landscape"}; margin: 0; }
body { margin: 0; padding: 0; font-family: ${font}; }
.certificate { width: ${width}; height: ${height}; position: relative; background: white; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; box-sizing: border-box; padding: 20mm; color: ${primary}; }
.border { position: absolute; inset: 8mm; border: 3px double ${accent}; border-radius: 4px; }
.border-inner { position: absolute; inset: 12mm; border: 1px solid ${accent}; border-radius: 2px; }
.logo { font-size: 14px; color: #666; letter-spacing: 4px; text-transform: uppercase; margin-bottom: 10mm; }
.title { font-size: 36px; color: ${primary}; font-weight: normal; margin: 0; letter-spacing: 2px; }
.subtitle { font-size: 16px; color: #666; margin: 8mm 0 6mm; font-style: italic; }
.name { font-size: 42px; color: ${primary}; font-weight: bold; margin: 0; padding-bottom: 3mm; border-bottom: 2px solid ${accent}; display: inline-block; min-width: 200px; }
.body { font-size: 14px; color: #444; margin: 8mm 0; max-width: ${portrait ? "150mm" : "180mm"}; line-height: 1.8; }
.event-title { font-weight: bold; color: ${primary}; }
.details { display: flex; justify-content: center; gap: ${portrait ? "15mm" : "30mm"}; margin-top: 15mm; }
.detail-item { text-align: center; }
.detail-label { font-size: 10px; color: #999; text-transform: uppercase; letter-spacing: 1px; }
.detail-line { width: 50mm; border-top: 1px solid #999; margin: 2mm auto; }
.detail-value { font-size: 12px; color: #333; }
.footer { position: absolute; bottom: 15mm; left: 0; right: 0; display: flex; justify-content: space-between; align-items: flex-end; padding: 0 25mm; }
.cert-id { font-size: 9px; color: #999; }
.qr { display: flex; align-items: center; gap: 3mm; }
.qr img { width: 20mm; height: 20mm; }
.qr-text { font-size: 8px; color: #999; text-align: left; }
</style></head>
<body><div class="certificate">
  <div class="border"></div>
  <div class="border-inner"></div>
  <div class="logo">EventFlow</div>
  <h1 class="title">${title}</h1>
  <p class="subtitle">This is to certify that</p>
  <h2 class="name">${data.recipientName}</h2>
  <p class="body">${body}</p>
  <div class="details">
    <div class="detail-item"><div class="detail-line"></div><div class="detail-value">${data.organizerName}</div><div class="detail-label">Organizer</div></div>
    <div class="detail-item"><div class="detail-line"></div><div class="detail-value">${data.issuedDate}</div><div class="detail-label">Date of Issue</div></div>
  </div>
  <div class="footer">
    <div class="cert-id">Certificate #: ${data.certificateNumber}</div>
    ${qrDataUrl ? `<div class="qr"><img src="${qrDataUrl}" alt="QR" /><div class="qr-text">Scan to verify<br/>${data.verificationCode}</div></div>` : `<div class="cert-id">Verify: ${verificationUrl}</div>`}
  </div>
</div></body></html>`
}
