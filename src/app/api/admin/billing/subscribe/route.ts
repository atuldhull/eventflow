import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { createAuditLog, getClientInfo } from "@/lib/audit"
import { PLAN_CONFIG } from "@/lib/subscription"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"
import { z } from "zod/v4"

const subscribeSchema = z.object({
  plan: z.enum(["FREE", "STARTER", "PRO", "ENTERPRISE"]),
  billingInterval: z.enum(["MONTHLY", "YEARLY"]).default("MONTHLY"),
  entityType: z.enum(["enterprise", "org"]),
  entityId: z.string().min(1),
})

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const parsed = subscribeSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: "Validation failed" }, { status: 400 })
    }

    const { plan, billingInterval, entityType, entityId } = parsed.data

    const { authorized, message } = await authorize(
      session.user.id,
      entityType === "org" ? PERMISSIONS.ORG_MANAGE_SETTINGS : PERMISSIONS.ENTERPRISE_MANAGE_BILLING,
      entityType === "org" ? { organizationId: entityId } : { enterpriseId: entityId }
    )
    if (!authorized) {
      return NextResponse.json({ success: false, message }, { status: 403 })
    }

    const config = PLAN_CONFIG[plan as keyof typeof PLAN_CONFIG]
    const price = billingInterval === "MONTHLY" ? config.price.monthly : config.price.yearly

    const now = new Date()
    const periodEnd = new Date(now)
    periodEnd.setDate(periodEnd.getDate() + (billingInterval === "MONTHLY" ? 30 : 365))

    // Upsert subscription
    const subscriptionData = {
      plan: plan as any,
      status: "ACTIVE" as any,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      amount: price,
      currency: "INR",
      billingInterval: billingInterval,
      maxEvents: config.limits.maxEvents,
      maxParticipantsPerEvent: config.limits.maxParticipantsPerEvent,
      maxOrganizations: config.limits.maxOrganizations,
      maxTeamMembers: config.limits.maxTeamMembers,
      features: Object.entries(config.features).filter(([, v]) => v).map(([k]) => k),
    }

    let subscription
    if (entityType === "org") {
      const existing = await prisma.subscription.findFirst({ where: { organizationId: entityId } })
      if (existing) {
        subscription = await prisma.subscription.update({ where: { id: existing.id }, data: subscriptionData })
      } else {
        subscription = await prisma.subscription.create({ data: { ...subscriptionData, organizationId: entityId } })
      }
    } else {
      const existing = await prisma.subscription.findFirst({ where: { enterprise: { id: entityId } } })
      if (existing) {
        subscription = await prisma.subscription.update({ where: { id: existing.id }, data: subscriptionData })
      } else {
        subscription = await prisma.subscription.create({ data: subscriptionData })
        await prisma.enterprise.update({ where: { id: entityId }, data: { subscriptionId: subscription.id } })
      }
    }

    const { ipAddress, userAgent } = getClientInfo(request)
    await createAuditLog({
      userId: session.user.id,
      action: "UPDATE",
      entityType: entityType === "enterprise" ? "ENTERPRISE" : "ORGANIZATION",
      entityId,
      description: `Subscribed to ${plan} plan (${billingInterval})`,
      newValues: { plan, billingInterval, price },
      ipAddress,
      userAgent,
    })

    return NextResponse.json({ success: true, data: subscription })
  } catch (error) {
    console.error("Subscribe error:", error)
    return NextResponse.json({ success: false, message: "Failed to subscribe" }, { status: 500 })
  }
}
