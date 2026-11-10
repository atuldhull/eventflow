import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { PDF_BLOCKED_STATUSES, TICKET_PDF_SELECT, buildTicketPdf, ticketPdfData } from "@/lib/ticket-pdf"

/** The holder's ticket as a PDF (QR on white). Guests use the link-token route instead. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { ticketId } = await params
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: TICKET_PDF_SELECT })

  if (!ticket || ticket.userId !== session.user.id) {
    return NextResponse.json({ success: false, message: "Ticket not found" }, { status: 404 })
  }
  if (PDF_BLOCKED_STATUSES.includes(ticket.status)) {
    return NextResponse.json({ success: false, message: "This ticket is no longer valid" }, { status: 410 })
  }

  return pdfResponse(buildTicketPdf(ticketPdfData(ticket)), ticket.ticketNumber)
}

function pdfResponse(pdf: Buffer, ticketNumber: string) {
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="ticket-${ticketNumber.replace(/[^\w-]/g, "")}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
