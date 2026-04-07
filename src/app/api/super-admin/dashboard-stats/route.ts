import { NextResponse } from "next/server"
import { withSuperAdmin } from "@/lib/guards"
import prisma from "@/lib/prisma"

export const GET = withSuperAdmin(async () => {
  const [totalUsers, totalEvents, activeEnterprises, recentEvents, recentActivity] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.event.count({ where: { deletedAt: null } }),
    prisma.enterprise.count({ where: { isActive: true, deletedAt: null } }),
    prisma.event.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
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
      totalUsers,
      totalEvents,
      activeEnterprises,
      totalRevenue: 0,
      userChange: 0,
      eventChange: 0,
      recentEvents: recentEvents.map((e) => ({
        id: e.id,
        title: e.title,
        organizer: e.organization?.name || "Direct",
        date: e.startDate.toISOString(),
        status: e.status,
        registrations: e.currentRegistrations,
      })),
      recentActivity: recentActivity.map((a) => ({
        id: a.id,
        user: a.user.name,
        action: a.action,
        description: `${a.action} ${a.entityType}${a.description ? `: ${a.description}` : ""}`,
        createdAt: a.createdAt.toISOString(),
      })),
    },
  })
})
