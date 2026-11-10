import type { Prisma } from "@prisma/client"
import prisma from "@/lib/prisma"
import { PLAN_CONFIG, type PlanName } from "@/lib/subscription"

export type BillingEntityType = "enterprise" | "org"
export type BillingInterval = "MONTHLY" | "YEARLY"

// Tags the Razorpay orders created for plan purchases, so verify/webhooks can tell
// them apart from event ticket orders.
export const PLAN_ORDER_PURPOSE = "plan_subscription"

// The charge for a plan, in rupees, always taken from server-side config.
export function getPlanAmount(plan: PlanName, billingInterval: BillingInterval): number {
  const config = PLAN_CONFIG[plan]
  return billingInterval === "MONTHLY" ? config.price.monthly : config.price.yearly
}

type Tx = Prisma.TransactionClient

function findEntitySubscription(tx: Tx, entityType: BillingEntityType, entityId: string) {
  return entityType === "org"
    ? tx.subscription.findFirst({ where: { organizationId: entityId } })
    : tx.subscription.findFirst({ where: { enterprise: { id: entityId } } })
}

// Row lock on the org/enterprise for the rest of the transaction. The verify route and
// the Razorpay webhook can deliver the same payment at the same moment; the second waits
// here, then sees the order id the first recorded and reports alreadyApplied.
async function lockBillingEntity(tx: Tx, entityType: BillingEntityType, entityId: string) {
  if (entityType === "org") {
    await tx.$queryRaw`SELECT id FROM "organizations" WHERE id = ${entityId} FOR UPDATE`
  } else {
    await tx.$queryRaw`SELECT id FROM "enterprises" WHERE id = ${entityId} FOR UPDATE`
  }
}

// Audit entry for an activation, written in the same transaction so exactly the call that
// performed the activation records it.
export type PlanActivationAudit = {
  userId: string
  description: string
  newValues?: Prisma.InputJsonValue
  ipAddress?: string
  userAgent?: string
}

function asJsonObject(value: Prisma.JsonValue | null | undefined): Prisma.JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Prisma.JsonObject) : {}
}

// Activates (or switches to) a plan for an org or enterprise. For paid plans pass the
// verified gateway payment: its order id is recorded so the same payment can't be
// replayed to start another billing period.
export async function activatePlan(params: {
  entityType: BillingEntityType
  entityId: string
  plan: PlanName
  billingInterval: BillingInterval
  payment?: { orderId: string; paymentId: string }
  audit?: PlanActivationAudit
}) {
  return prisma.$transaction((tx) => activatePlanInTx(tx, params))
}

async function activatePlanInTx(
  tx: Tx,
  params: Parameters<typeof activatePlan>[0]
) {
  const { entityType, entityId, plan, billingInterval, payment, audit } = params
  const config = PLAN_CONFIG[plan]
  const price = getPlanAmount(plan, billingInterval)

  await lockBillingEntity(tx, entityType, entityId)
  const existing = await findEntitySubscription(tx, entityType, entityId)

  let metadata: Prisma.InputJsonObject | undefined
  if (payment) {
    const prev = asJsonObject(existing?.metadata)
    const paidOrderIds = Array.isArray(prev.paidOrderIds) ? prev.paidOrderIds.filter((id): id is string => typeof id === "string") : []
    if (existing && paidOrderIds.includes(payment.orderId)) {
      return { subscription: existing, alreadyApplied: true }
    }
    metadata = {
      ...prev,
      paidOrderIds: [...paidOrderIds, payment.orderId].slice(-50),
      lastPayment: { orderId: payment.orderId, paymentId: payment.paymentId, plan, billingInterval, amount: price, paidAt: new Date().toISOString() },
    }
  }

  const now = new Date()
  const periodEnd = new Date(now)
  periodEnd.setDate(periodEnd.getDate() + (billingInterval === "MONTHLY" ? 30 : 365))

  const subscriptionData = {
    plan,
    status: "ACTIVE" as const,
    currentPeriodStart: now,
    currentPeriodEnd: periodEnd,
    amount: price,
    currency: "INR",
    billingInterval,
    maxEvents: config.limits.maxEvents,
    maxParticipantsPerEvent: config.limits.maxParticipantsPerEvent,
    maxOrganizations: config.limits.maxOrganizations,
    maxTeamMembers: config.limits.maxTeamMembers,
    features: Object.entries(config.features).filter(([, v]) => v).map(([k]) => k),
    ...(metadata ? { metadata } : {}),
  }

  let subscription
  if (existing) {
    subscription = await tx.subscription.update({ where: { id: existing.id }, data: subscriptionData })
  } else if (entityType === "org") {
    subscription = await tx.subscription.create({ data: { ...subscriptionData, organizationId: entityId } })
  } else {
    subscription = await tx.subscription.create({ data: subscriptionData })
    await tx.enterprise.update({ where: { id: entityId }, data: { subscriptionId: subscription.id } })
  }

  if (audit) {
    await tx.auditLog.create({
      data: {
        userId: audit.userId,
        action: "UPDATE",
        entityType: entityType === "enterprise" ? "ENTERPRISE" : "ORGANIZATION",
        entityId,
        description: audit.description,
        newValues: audit.newValues,
        ipAddress: audit.ipAddress,
        userAgent: audit.userAgent,
        ...(entityType === "enterprise" ? { enterpriseId: entityId } : { organizationId: entityId }),
      },
    })
  }

  return { subscription, alreadyApplied: false }
}
