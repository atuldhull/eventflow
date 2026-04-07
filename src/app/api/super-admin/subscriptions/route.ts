import { NextResponse } from "next/server"
import { withSuperAdmin } from "@/lib/guards"
import prisma from "@/lib/prisma"

export const GET = withSuperAdmin(async () => {
  // Count subscribers by plan
  const [freeCount, starterCount, proCount, enterpriseCount, subscriptions] = await Promise.all([
    prisma.subscription.count({ where: { plan: "FREE" } }),
    prisma.subscription.count({ where: { plan: "STARTER" } }),
    prisma.subscription.count({ where: { plan: "PRO" } }),
    prisma.subscription.count({ where: { plan: "ENTERPRISE" } }),
    prisma.subscription.findMany({
      where: { plan: { not: "FREE" } },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true, plan: true, status: true, billingInterval: true, amount: true,
        currentPeriodStart: true, currentPeriodEnd: true, createdAt: true,
        enterprise: { select: { name: true } },
        organization: { select: { name: true } },
      },
    }),
  ])

  return NextResponse.json({
    success: true,
    data: {
      planCounts: { FREE: freeCount, STARTER: starterCount, PRO: proCount, ENTERPRISE: enterpriseCount },
      subscriptions: subscriptions.map((s) => ({
        id: s.id, plan: s.plan, status: s.status, interval: s.billingInterval,
        price: s.amount ? Number(s.amount) : 0,
        tenant: s.enterprise?.name || s.organization?.name || "—",
        currentPeriodEnd: s.currentPeriodEnd?.toISOString() || null,
        createdAt: s.createdAt.toISOString(),
      })),
    },
  })
})
