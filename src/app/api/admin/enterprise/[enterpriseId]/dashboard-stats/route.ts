import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { enterpriseId } = await params

  const authResult = await authorize(session.user.id, PERMISSIONS.ENTERPRISE_VIEW, { enterpriseId })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  const [orgCount, eventCount, registrationCount, recentEvents, recentActivity] = await Promise.all([
    prisma.organization.count({ where: { enterpriseId, isActive: true, deletedAt: null } }),
    prisma.event.count({ where: { enterpriseId, deletedAt: null } }),
    prisma.registration.count({
      where: { event: { enterpriseId } },
    }),
    prisma.event.findMany({
      where: { enterpriseId, deletedAt: null, startDate: { gte: new Date() } },
      orderBy: { startDate: "asc" },
      take: 5,
      select: {
        id: true,
        title: true,
        status: true,
        startDate: true,
        currentRegistrations: true,
        organization: { select: { name: true } },
      },
    }),
    prisma.auditLog.findMany({
      where: { enterpriseId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        action: true,
        entityType: true,
        description: true,
        createdAt: true,
        user: { select: { name: true } },
      },
    }),
  ])

  return NextResponse.json({
    success: true,
    data: {
      orgCount,
      eventCount,
      registrationCount,
      totalRevenue: 0,
      recentEvents: recentEvents.map((e) => ({
        id: e.id,
        title: e.title,
        organization: e.organization?.name || "Direct",
        date: e.startDate.toISOString(),
        status: e.status,
        registrations: e.currentRegistrations,
      })),
      recentActivity: recentActivity.map((a) => ({
        id: a.id,
        user: a.user.name,
        action: a.action,
        description: a.description || `${a.action} ${a.entityType}`,
        createdAt: a.createdAt.toISOString(),
      })),
    },
  })
}
