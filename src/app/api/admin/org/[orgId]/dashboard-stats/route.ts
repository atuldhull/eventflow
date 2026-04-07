import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { orgId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.EVENT_VIEW, { organizationId: orgId })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  const [eventCount, registrationCount, memberCount, recentEvents] = await Promise.all([
    prisma.event.count({ where: { organizationId: orgId, deletedAt: null } }),
    prisma.registration.count({ where: { event: { organizationId: orgId } } }),
    prisma.organizationMember.count({ where: { organizationId: orgId, isActive: true } }),
    prisma.event.findMany({
      where: { organizationId: orgId, deletedAt: null, startDate: { gte: new Date() } },
      orderBy: { startDate: "asc" },
      take: 5,
      select: { id: true, title: true, status: true, startDate: true, currentRegistrations: true, maxCapacity: true },
    }),
  ])

  return NextResponse.json({
    success: true,
    data: {
      eventCount,
      registrationCount,
      memberCount,
      totalRevenue: 0,
      upcomingEvents: recentEvents.map((e) => ({ ...e, startDate: e.startDate.toISOString() })),
    },
  })
}
