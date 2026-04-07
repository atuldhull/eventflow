import prisma from "@/lib/prisma"
import { PLANS } from "@/config/plans"

export async function startTrial(entityType: "enterprise" | "org", entityId: string) {
  const trialEndsAt = new Date()
  trialEndsAt.setDate(trialEndsAt.getDate() + PLANS.PRO.trialDays)

  const plan = PLANS.PRO

  const data = {
    plan: "PRO" as any,
    status: "TRIAL" as any,
    currentPeriodStart: new Date(),
    currentPeriodEnd: trialEndsAt,
    trialEndsAt,
    amount: 0,
    currency: "INR",
    billingInterval: "MONTHLY",
    maxEvents: plan.limits.maxEventsPerMonth,
    maxParticipantsPerEvent: plan.limits.maxParticipantsPerEvent,
    maxOrganizations: plan.limits.maxOrganizations,
    maxTeamMembers: plan.limits.maxTeamMembers,
    features: Object.entries(plan.features).filter(([, v]) => v).map(([k]) => k),
  }

  if (entityType === "org") {
    return prisma.subscription.create({ data: { ...data, organizationId: entityId } })
  }

  const subscription = await prisma.subscription.create({ data })
  await prisma.enterprise.update({ where: { id: entityId }, data: { subscriptionId: subscription.id } })
  return subscription
}

export async function extendTrial(subscriptionId: string, additionalDays: number) {
  const subscription = await prisma.subscription.findUnique({ where: { id: subscriptionId } })
  if (!subscription || subscription.status !== "TRIAL") throw new Error("Not a trial subscription")

  const newTrialEnd = new Date(subscription.trialEndsAt || new Date())
  newTrialEnd.setDate(newTrialEnd.getDate() + additionalDays)

  return prisma.subscription.update({
    where: { id: subscriptionId },
    data: { trialEndsAt: newTrialEnd, currentPeriodEnd: newTrialEnd },
  })
}

export async function getTrialDaysRemaining(subscriptionId: string): Promise<number> {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    select: { trialEndsAt: true, status: true },
  })

  if (!subscription || subscription.status !== "TRIAL" || !subscription.trialEndsAt) return 0

  const now = new Date()
  const diff = subscription.trialEndsAt.getTime() - now.getTime()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}
