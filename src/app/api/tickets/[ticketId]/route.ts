import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"

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
          id: true, title: true, slug: true, startDate: true, endDate: true,
          venue: true, venueCity: true, venueAddress: true, isOnline: true,
          onlinePlatform: true, onlineLink: true, coverImage: true,
          organization: { select: { name: true, logo: true } },
        },
      },
      ticketType: { select: { name: true, price: true, currency: true } },
      registration: { select: { registrationNumber: true, status: true, formResponses: true } },
      user: { select: { id: true, name: true, email: true } },
      checkIns: { select: { checkedInAt: true, checkInMethod: true } },
    },
  })

  if (!ticket) {
    return NextResponse.json({ success: false, message: "Ticket not found" }, { status: 404 })
  }

  // Only owner or admin can view
  if (ticket.userId !== session.user.id) {
    return NextResponse.json({ success: false, message: "Access denied" }, { status: 403 })
  }

  return NextResponse.json({ success: true, data: ticket })
}
