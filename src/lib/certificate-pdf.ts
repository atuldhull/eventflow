import QRCode from "qrcode"

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

export async function generateCertificateHTML(data: CertificateData): Promise<string> {
  const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://eventflow.com"}/verify/${data.verificationCode}`
  let qrDataUrl = ""
  try {
    qrDataUrl = await QRCode.toDataURL(verificationUrl, { width: 100, margin: 1 })
  } catch {}

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${data.title}</title>
<style>
@page { size: A4 landscape; margin: 0; }
body { margin: 0; padding: 0; font-family: 'Georgia', 'Times New Roman', serif; }
.certificate { width: 297mm; height: 210mm; position: relative; background: white; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; box-sizing: border-box; padding: 20mm; }
.border { position: absolute; inset: 8mm; border: 3px double #c9a96e; border-radius: 4px; }
.border-inner { position: absolute; inset: 12mm; border: 1px solid #c9a96e; border-radius: 2px; }
.logo { font-size: 14px; color: #666; letter-spacing: 4px; text-transform: uppercase; margin-bottom: 10mm; }
.title { font-size: 36px; color: #1a1a1a; font-weight: normal; margin: 0; letter-spacing: 2px; }
.subtitle { font-size: 16px; color: #666; margin: 8mm 0 6mm; font-style: italic; }
.name { font-size: 42px; color: #1a1a1a; font-weight: bold; margin: 0; padding-bottom: 3mm; border-bottom: 2px solid #c9a96e; display: inline-block; min-width: 200px; }
.body { font-size: 14px; color: #444; margin: 8mm 0; max-width: 180mm; line-height: 1.8; }
.event-title { font-weight: bold; color: #1a1a1a; }
.details { display: flex; justify-content: center; gap: 30mm; margin-top: 15mm; }
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
  <h1 class="title">${data.title}</h1>
  <p class="subtitle">This is to certify that</p>
  <h2 class="name">${data.recipientName}</h2>
  <p class="body">has successfully ${data.type === "PARTICIPATION" ? "participated in" : data.type === "WINNER" ? "won at" : data.type === "VOLUNTEER" ? "volunteered at" : "been recognized at"} <span class="event-title">${data.eventTitle}</span>, organized by ${data.organizerName} on ${data.eventDate}.</p>
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
