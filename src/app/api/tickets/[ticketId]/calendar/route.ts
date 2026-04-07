import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { generateICSFile } from "@/lib/calendar"

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
        select: {
          title: true, slug: true, description: true, startDate: true, endDate: true,
          venue: true, venueAddress: true, isOnline: true, onlinePlatform: true, onlineLink: true,
          organization: { select: { name: true, email: true } },
        },
      },
    },
  })

  if (!ticket || ticket.userId !== session.user.id) {
    return NextResponse.json({ success: false, message: "Ticket not found" }, { status: 404 })
  }

  const ics = generateICSFile(
    {
      title: ticket.event.title,
      description: ticket.event.description || undefined,
      startDate: ticket.event.startDate,
      endDate: ticket.event.endDate,
      venue: ticket.event.venue,
      venueAddress: ticket.event.venueAddress,
      isOnline: ticket.event.isOnline,
      onlineLink: ticket.event.onlineLink,
      onlinePlatform: ticket.event.onlinePlatform,
      slug: ticket.event.slug,
      organizerName: ticket.event.organization?.name,
      organizerEmail: ticket.event.organization?.email,
    },
    ticket.ticketNumber
  )

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${ticket.event.slug || "event"}.ics"`,
    },
  })
}
