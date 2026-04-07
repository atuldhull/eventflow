import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { generateInvoiceHTML } from "@/lib/invoice"
import { formatINR } from "@/lib/tax"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { ticketId } = await params

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      event: {
        select: { title: true, startDate: true, endDate: true, venue: true, venueCity: true, isOnline: true, onlinePlatform: true },
      },
      ticketType: { select: { name: true, price: true } },
      registration: { select: { registrationNumber: true } },
      user: { select: { name: true, email: true } },
    },
  })

  if (!ticket || ticket.userId !== session.user.id) {
    return NextResponse.json({ success: false, message: "Ticket not found" }, { status: 404 })
  }

  const date = ticket.event.startDate.toLocaleDateString("en-IN", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
  const time = ticket.event.startDate.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })
  const location = ticket.event.isOnline ? `Online via ${ticket.event.onlinePlatform || "Virtual Platform"}` : `${ticket.event.venue || ""}, ${ticket.event.venueCity || ""}`

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Ticket ${ticket.ticketNumber}</title>
<style>body{font-family:-apple-system,sans-serif;margin:0;padding:40px;color:#1a1a1a;}
.ticket{max-width:600px;margin:0 auto;border:2px solid #e5e5e5;border-radius:12px;overflow:hidden;}
.header{background:#09090b;color:white;padding:24px;text-align:center;}
.header h1{margin:0;font-size:20px;}
.header p{margin:4px 0 0;opacity:0.7;font-size:13px;}
.body{padding:24px;display:flex;gap:24px;}
.info{flex:1;}
.info h2{margin:0 0 16px;font-size:16px;}
.row{display:flex;justify-content:space-between;padding:6px 0;font-size:13px;border-bottom:1px solid #f0f0f0;}
.row .label{color:#666;}
.qr{text-align:center;padding:16px;border-left:2px dashed #e5e5e5;}
.qr p{margin:8px 0 0;font-family:monospace;font-size:14px;font-weight:bold;letter-spacing:2px;}
.footer{background:#f9fafb;padding:12px;text-align:center;font-size:11px;color:#999;}
@media print{body{padding:0;}.ticket{border:none;}}</style></head>
<body><div class="ticket">
<div class="header"><h1>${ticket.event.title}</h1><p>${date} at ${time}</p></div>
<div class="body">
<div class="info"><h2>Ticket Details</h2>
<div class="row"><span class="label">Ticket</span><span>${ticket.ticketType.name}</span></div>
<div class="row"><span class="label">Price</span><span>${Number(ticket.ticketType.price) > 0 ? formatINR(Number(ticket.ticketType.price)) : "Free"}</span></div>
<div class="row"><span class="label">Registration</span><span>${ticket.registration.registrationNumber}</span></div>
<div class="row"><span class="label">Participant</span><span>${ticket.user.name}</span></div>
<div class="row"><span class="label">Location</span><span>${location}</span></div>
</div>
<div class="qr"><img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(ticket.qrCode)}" width="150" height="150" alt="QR Code" /><p>${ticket.ticketNumber}</p></div>
</div>
<div class="footer">Present this ticket at the event entrance. Powered by EventFlow.</div>
</div></body></html>`

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html",
      "Content-Disposition": `inline; filename="ticket-${ticket.ticketNumber}.html"`,
    },
  })
}
