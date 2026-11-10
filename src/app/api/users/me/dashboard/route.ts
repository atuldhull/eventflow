import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { revenueTotals } from "@/lib/revenue"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const userId = session.user.id

  const [registrations, tickets, certificates, payments, upcomingEvents] = await Promise.all([
    prisma.registration.count({ where: { userId } }),
    prisma.ticket.count({ where: { userId, status: "ACTIVE" } }),
    prisma.certificate.count({ where: { userId } }),
    revenueTotals({ userId }),
    prisma.registration.findMany({
      // events that haven't ended, so one that is running stays listed ("Happening now")
      where: { userId, status: { in: ["CONFIRMED", "PENDING", "CHECKED_IN"] }, event: { endDate: { gte: new Date() }, deletedAt: null } },
      orderBy: { event: { startDate: "asc" } },
      take: 5,
      select: {
        id: true, status: true,
        event: { select: { id: true, title: true, slug: true, startDate: true, venue: true, venueCity: true, isOnline: true, category: true, organization: { select: { name: true } } } },
      },
    }),
  ])

  return NextResponse.json({
    success: true,
    data: {
      stats: {
        registrations,
        activeTickets: tickets,
        certificates,
        totalSpent: payments.net, // what they paid minus refunds
      },
      upcomingEvents: upcomingEvents.map((r) => ({
        registrationId: r.id,
        status: r.status,
        ...r.event,
        startDate: r.event.startDate.toISOString(),
      })),
    },
  })
}
