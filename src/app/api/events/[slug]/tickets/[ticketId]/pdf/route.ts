import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import prisma from "@/lib/prisma"
import { rateLimiter, RATE_LIMITS } from "@/lib/rate-limiter"
import { getClientInfo } from "@/lib/audit"
import { PDF_BLOCKED_STATUSES, TICKET_PDF_SELECT, buildTicketPdf, ticketPdfData } from "@/lib/ticket-pdf"
import { ticketViewTokenMatches } from "@/lib/ticket-view-token"

/**
 * A guest's ticket PDF, opened from their view-only ticket link (no account session):
 * GET /api/events/<slug>/tickets/<ticketId>/pdf?k=<token>. The token must match the hash
 * stored on that ticket, and the ticket must belong to the event in the path.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; ticketId: string }> }
) {
  const limit = await rateLimiter.check(`ticket-link:${getClientInfo(request).ipAddress}`, RATE_LIMITS.registration.limit * 6, RATE_LIMITS.registration.windowMs)
  if (!limit.allowed) {
    return NextResponse.json({ success: false, message: "Too many requests" }, { status: 429 })
  }

  const { slug, ticketId } = await params
  const token = request.nextUrl.searchParams.get("k")
  const ticket = ticketId.length <= 64 ? await prisma.ticket.findUnique({ where: { id: ticketId }, select: TICKET_PDF_SELECT }) : null

  // one answer for a wrong id, slug or token: nothing about the ticket leaks
  if (!ticket || ticket.event.slug !== slug || !ticketViewTokenMatches(ticket.metadata, token)) {
    return NextResponse.json({ success: false, message: "Ticket not found" }, { status: 404 })
  }
  if (PDF_BLOCKED_STATUSES.includes(ticket.status)) {
    return NextResponse.json({ success: false, message: "This ticket is no longer valid" }, { status: 410 })
  }

  return new NextResponse(new Uint8Array(buildTicketPdf(ticketPdfData(ticket))), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="ticket-${ticket.ticketNumber.replace(/[^\w-]/g, "")}.pdf"`,
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
