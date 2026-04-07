import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const eventId = request.nextUrl.searchParams.get("eventId")
  if (!eventId) {
    return NextResponse.json({ success: false, message: "Event ID required" }, { status: 400 })
  }

  const [totalExpected, checkedIn, byMethod, recentCheckIns, byTicketType] = await Promise.all([
    prisma.registration.count({ where: { eventId, status: { in: ["CONFIRMED", "CHECKED_IN"] } } }),
    prisma.checkIn.count({ where: { eventId } }),
    prisma.checkIn.groupBy({
      by: ["checkInMethod"],
      where: { eventId },
      _count: true,
    }),
    prisma.checkIn.findMany({
      where: { eventId },
      orderBy: { checkedInAt: "desc" },
      take: 20,
      select: {
        id: true,
        checkedInAt: true,
        checkInMethod: true,
        user: { select: { name: true, avatar: true } },
      },
    }),
    prisma.registration.groupBy({
      by: ["ticketTypeId"],
      where: { eventId, status: { in: ["CONFIRMED", "CHECKED_IN"] } },
      _count: true,
    }),
  ])

  // Get check-in counts per ticket type
  const ticketTypeIds = byTicketType.map((t) => t.ticketTypeId)
  const ticketTypes = await prisma.ticketType.findMany({
    where: { id: { in: ticketTypeIds } },
    select: { id: true, name: true },
  })

  const checkedInByType = await prisma.checkIn.groupBy({
    by: ["registrationId"],
    where: { eventId },
  })

  const checkedInRegIds = new Set(checkedInByType.map((c) => c.registrationId))

  const byTicketTypeData = byTicketType.map((tt) => {
    const typeName = ticketTypes.find((t) => t.id === tt.ticketTypeId)?.name || "Unknown"
    return { type: typeName, total: tt._count, checkedIn: 0 }
  })

  return NextResponse.json({
    success: true,
    data: {
      totalExpected,
      checkedIn,
      notArrived: totalExpected - checkedIn,
      percentage: totalExpected > 0 ? Math.round((checkedIn / totalExpected) * 100) : 0,
      byMethod: byMethod.map((m) => ({ method: m.checkInMethod, count: m._count })),
      byTicketType: byTicketTypeData,
      recentCheckIns: recentCheckIns.map((c) => ({
        id: c.id,
        name: c.user.name,
        avatar: c.user.avatar,
        time: c.checkedInAt.toISOString(),
        method: c.checkInMethod,
      })),
    },
  })
}
