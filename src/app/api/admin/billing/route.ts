import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { getUsage, getUsageAlerts } from "@/lib/usage"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"
import { PLANS, type PlanId } from "@/config/plans"

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const entityType = request.nextUrl.searchParams.get("entityType") as "enterprise" | "org" || "org"
  const entityId = request.nextUrl.searchParams.get("entityId")
  if (!entityId) return NextResponse.json({ success: false, message: "Entity ID required" }, { status: 400 })

  const access = await authorize(
    session.user.id,
    entityType === "enterprise" ? PERMISSIONS.ENTERPRISE_VIEW : PERMISSIONS.ORG_VIEW,
    entityType === "enterprise" ? { enterpriseId: entityId } : { organizationId: entityId }
  )
  if (!access.authorized) {
    return NextResponse.json({ success: false, message: access.message }, { status: 403 })
  }

  const subscription = entityType === "enterprise"
    ? await prisma.subscription.findFirst({ where: { enterprise: { id: entityId } } })
    : await prisma.subscription.findFirst({ where: { organizationId: entityId } })

  const planId = (subscription?.plan as PlanId) || "FREE"
  const plan = PLANS[planId]

  const usage = await getUsage(entityType, entityId)
  const alerts = getUsageAlerts(usage)

  const features: Record<string, boolean> = {}
  for (const [key, value] of Object.entries(plan.features)) {
    features[key] = value
  }

  return NextResponse.json({
    success: true,
    data: {
      subscription: subscription ? {
        id: subscription.id,
        plan: subscription.plan,
        status: subscription.status,
        interval: subscription.billingInterval,
        price: Number(subscription.amount),
        currentPeriodStart: subscription.currentPeriodStart.toISOString(),
        currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
        trialEndsAt: subscription.trialEndsAt?.toISOString() || null,
        cancelledAt: subscription.cancelledAt?.toISOString() || null,
      } : { plan: "FREE", status: "ACTIVE", interval: "MONTHLY", price: 0 },
      usage,
      features,
      alerts,
      planDetails: { name: plan.name, description: plan.description, limits: plan.limits },
    },
  })
}
