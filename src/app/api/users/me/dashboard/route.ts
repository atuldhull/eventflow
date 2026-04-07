import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"

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
    prisma.payment.aggregate({ where: { userId, status: "COMPLETED" }, _sum: { amount: true } }),
    prisma.registration.findMany({
      where: { userId, status: { in: ["CONFIRMED", "PENDING"] }, event: { startDate: { gte: new Date() }, deletedAt: null } },
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
        totalSpent: payments._sum.amount ? Number(payments._sum.amount) : 0,
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
