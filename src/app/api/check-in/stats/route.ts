import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const eventId = request.nextUrl.searchParams.get("eventId")?.slice(0, 64)
  if (!eventId) {
    return NextResponse.json({ success: false, message: "Event ID required" }, { status: 400 })
  }

  const authResult = await authorize(session.user.id, PERMISSIONS.CHECKIN_VIEW, { eventId })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  const admitted = { eventId, status: { in: ["CONFIRMED" as const, "CHECKED_IN" as const] } }
  const [totalExpected, checkedIn, byMethod, recentCheckIns, byTicketType, checkedInByType] = await Promise.all([
    prisma.registration.count({ where: admitted }),
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
        performer: { select: { name: true } },
        registration: { select: { registrationNumber: true, ticketType: { select: { name: true } } } },
      },
    }),
    prisma.registration.groupBy({
      by: ["ticketTypeId"],
      where: admitted,
      _count: true,
    }),
    prisma.registration.groupBy({
      by: ["ticketTypeId"],
      where: { eventId, status: "CHECKED_IN" },
      _count: true,
    }),
  ])

  const ticketTypes = await prisma.ticketType.findMany({
    where: { id: { in: byTicketType.map((t) => t.ticketTypeId) }, eventId },
    select: { id: true, name: true },
  })
  const checkedInCount = new Map(checkedInByType.map((c) => [c.ticketTypeId, c._count]))

  return NextResponse.json({
    success: true,
    data: {
      totalExpected,
      checkedIn,
      notArrived: Math.max(0, totalExpected - checkedIn),
      percentage: totalExpected > 0 ? Math.round((checkedIn / totalExpected) * 100) : 0,
      byMethod: byMethod.map((m) => ({ method: m.checkInMethod, count: m._count })),
      byTicketType: byTicketType.map((tt) => ({
        type: ticketTypes.find((t) => t.id === tt.ticketTypeId)?.name || "Unknown",
        total: tt._count,
        checkedIn: checkedInCount.get(tt.ticketTypeId) ?? 0,
      })),
      recentCheckIns: recentCheckIns.map((c) => ({
        id: c.id,
        name: c.user.name,
        avatar: c.user.avatar,
        time: c.checkedInAt.toISOString(),
        method: c.checkInMethod,
        by: c.performer?.name ?? null,
        registrationNumber: c.registration?.registrationNumber ?? null,
        ticketType: c.registration?.ticketType?.name ?? null,
      })),
    },
  })
}
