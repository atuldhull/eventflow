import prisma from "@/lib/prisma"

export const PLAN_CONFIG = {
  FREE: {
    price: { monthly: 0, yearly: 0 },
    limits: { maxEvents: 5, maxParticipantsPerEvent: 100, maxOrganizations: 1, maxTeamMembers: 5 },
    features: { customBranding: false, apiAccess: false, advancedAnalytics: false, customDomain: false, smsNotifications: false, prioritySupport: false },
  },
  STARTER: {
    price: { monthly: 999, yearly: 9999 },
    limits: { maxEvents: 25, maxParticipantsPerEvent: 500, maxOrganizations: 3, maxTeamMembers: 15 },
    features: { customBranding: true, apiAccess: false, advancedAnalytics: true, customDomain: false, smsNotifications: true, prioritySupport: false },
  },
  PRO: {
    price: { monthly: 2999, yearly: 29999 },
    limits: { maxEvents: -1, maxParticipantsPerEvent: 5000, maxOrganizations: 10, maxTeamMembers: 50 },
    features: { customBranding: true, apiAccess: true, advancedAnalytics: true, customDomain: true, smsNotifications: true, prioritySupport: true },
  },
  ENTERPRISE: {
    price: { monthly: 0, yearly: 0 },
    limits: { maxEvents: -1, maxParticipantsPerEvent: -1, maxOrganizations: -1, maxTeamMembers: -1 },
    features: { customBranding: true, apiAccess: true, advancedAnalytics: true, customDomain: true, smsNotifications: true, prioritySupport: true },
  },
} as const

export type PlanName = keyof typeof PLAN_CONFIG

// Tier ordering for entitlement checks. Mirrors the SubscriptionPlan enum in schema.prisma.
const PLAN_RANK: Record<PlanName, number> = {
  FREE: 0,
  STARTER: 1,
  PRO: 2,
  ENTERPRISE: 3,
}

// Only these statuses entitle an entity to its paid tier. Anything else (PAST_DUE,
// CANCELLED, EXPIRED) falls back to FREE.
const ENTITLED_STATUSES = ["ACTIVE", "TRIAL"] as const

export function isValidPlan(plan: string | null | undefined): plan is PlanName {
  return !!plan && plan in PLAN_RANK
}

// True when currentPlan is at or above requiredPlan. Unknown plan names fail closed.
export function isPlanSufficient(
  currentPlan: string | null | undefined,
  requiredPlan: string | null | undefined
): boolean {
  if (!isValidPlan(requiredPlan)) return false
  const current = isValidPlan(currentPlan) ? currentPlan : "FREE"
  return PLAN_RANK[current] >= PLAN_RANK[requiredPlan]
}

// Resolves the plan an org is actually entitled to right now.
export async function getEntityPlan(entityType: "enterprise" | "org", entityId: string): Promise<PlanName> {
  const subscription = entityType === "enterprise"
    ? await prisma.subscription.findFirst({ where: { enterprise: { id: entityId } } })
    : await prisma.subscription.findFirst({ where: { organizationId: entityId } })

  if (!subscription) return "FREE"
  if (!ENTITLED_STATUSES.includes(subscription.status as (typeof ENTITLED_STATUSES)[number])) return "FREE"
  return isValidPlan(subscription.plan) ? subscription.plan : "FREE"
}

export async function checkUsageLimits(entityType: "enterprise" | "org", entityId: string) {
  const subscription = entityType === "enterprise"
    ? await prisma.subscription.findFirst({ where: { enterprise: { id: entityId } } })
    : await prisma.subscription.findFirst({ where: { organizationId: entityId } })

  const plan = (subscription?.plan as PlanName) || "FREE"
  const config = PLAN_CONFIG[plan]

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [eventCount, memberCount, orgCount] = await Promise.all([
    entityType === "org"
      ? prisma.event.count({ where: { organizationId: entityId, deletedAt: null, createdAt: { gte: monthStart } } })
      : prisma.event.count({ where: { OR: [{ enterpriseId: entityId }, { organization: { enterpriseId: entityId } }], deletedAt: null, createdAt: { gte: monthStart } } }),
    entityType === "org"
      ? prisma.organizationMember.count({ where: { organizationId: entityId, isActive: true } })
      : prisma.enterpriseMember.count({ where: { enterpriseId: entityId, isActive: true } }),
    entityType === "enterprise"
      ? prisma.organization.count({ where: { enterpriseId: entityId, isActive: true, deletedAt: null } })
      : Promise.resolve(0),
  ])

  return {
    events: { used: eventCount, limit: config.limits.maxEvents, percentage: config.limits.maxEvents === -1 ? 0 : Math.round((eventCount / config.limits.maxEvents) * 100) },
    teamMembers: { used: memberCount, limit: config.limits.maxTeamMembers, percentage: config.limits.maxTeamMembers === -1 ? 0 : Math.round((memberCount / config.limits.maxTeamMembers) * 100) },
    organizations: { used: orgCount, limit: config.limits.maxOrganizations, percentage: config.limits.maxOrganizations === -1 ? 0 : Math.round((orgCount / config.limits.maxOrganizations) * 100) },
    plan,
    planConfig: config,
  }
}

export async function enforceLimit(
  entityType: "enterprise" | "org",
  entityId: string,
  limitType: "events" | "teamMembers" | "organizations"
): Promise<{ allowed: boolean; message?: string }> {
  const usage = await checkUsageLimits(entityType, entityId)
  const { used, limit } = usage[limitType]

  if (limit === -1) return { allowed: true }
  if (used >= limit) {
    return {
      allowed: false,
      message: `You've reached the limit of ${limit} ${limitType} on the ${usage.plan} plan. Upgrade to add more.`,
    }
  }
  return { allowed: true }
}

export function getUpgradePrompt(limitType: string, currentPlan: PlanName): string {
  const upgradeTo = currentPlan === "FREE" ? "STARTER" : currentPlan === "STARTER" ? "PRO" : "ENTERPRISE"
  const nextConfig = PLAN_CONFIG[upgradeTo as PlanName]
  const limit = nextConfig.limits[limitType as keyof typeof nextConfig.limits]
  return `Upgrade to ${upgradeTo} for ${limit === -1 ? "unlimited" : limit} ${limitType}.`
}
