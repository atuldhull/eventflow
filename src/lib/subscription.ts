import { Prisma } from "@prisma/client"
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
  // Matches the public pricing page: Pro is ₹999 a month (₹9,999 a year). STARTER is a legacy
  // tier kept for existing subscriptions; it is no longer offered as an upgrade.
  PRO: {
    price: { monthly: 999, yearly: 9999 },
    limits: { maxEvents: -1, maxParticipantsPerEvent: 5000, maxOrganizations: 5, maxTeamMembers: 25 },
    features: { customBranding: true, apiAccess: true, advancedAnalytics: true, customDomain: false, smsNotifications: true, prioritySupport: true },
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

// ============================================================================
// EVENT LIMIT ("N events per month"): the one rule used by create, duplicate, recurrence
// generation and the billing usage display.
// ============================================================================

/** Whose subscription sets an organization's limits. */
export type PlanScope = { entityType: "enterprise" | "org"; entityId: string }

/** Start of the current calendar month (server local time): the monthly event count starts here. */
export function startOfEventMonth(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

/** When the monthly event count resets: the 1st of next month (server local time). */
export function eventLimitResetsAt(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth() + 1, 1)
}

/** "1 December 2026" */
export function formatResetDate(date: Date): string {
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
}

/**
 * Not a saved event template. Templates are Event rows with settings.isTemplate = true
 * (src/app/api/admin/org/[orgId]/event-templates). NULL-safe on purpose: a bare
 * NOT { settings.isTemplate = true } also drops every event whose settings are NULL or
 * lack the key (SQL: NOT (NULL = true) is NULL), so those are matched explicitly
 * (a path filter equal to DbNull is "settings #> '{isTemplate}' IS NULL").
 */
export function notTemplateEventWhere(): Prisma.EventWhereInput {
  return {
    OR: [
      { settings: { path: ["isTemplate"], equals: Prisma.DbNull } },
      { NOT: { settings: { path: ["isTemplate"], equals: true } } },
    ],
  }
}

/**
 * The events that count against the plan's monthly limit ("N events per month"): created
 * since the 1st of the current month, not deleted, not cancelled and not a saved template.
 * An enterprise's plan counts the events of all its organizations.
 */
export function eventsThisMonthWhere(scope: PlanScope, now = new Date()): Prisma.EventWhereInput {
  return {
    ...(scope.entityType === "enterprise"
      ? { OR: [{ enterpriseId: scope.entityId }, { organization: { enterpriseId: scope.entityId } }] }
      : { organizationId: scope.entityId }),
    createdAt: { gte: startOfEventMonth(now) },
    deletedAt: null,
    status: { not: "CANCELLED" },
    AND: [notTemplateEventWhere()],
  }
}

/**
 * An organization inside an enterprise runs on the enterprise's subscription (the
 * enterprise owns billing); a standalone organization on its own.
 */
export async function resolvePlanScope(orgId: string): Promise<PlanScope> {
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { enterpriseId: true } })
  return org?.enterpriseId ? { entityType: "enterprise", entityId: org.enterpriseId } : { entityType: "org", entityId: orgId }
}

export function countEventsThisMonth(scope: PlanScope, now = new Date()): Promise<number> {
  return prisma.event.count({ where: eventsThisMonthWhere(scope, now) })
}

const PLAN_LABEL: Record<PlanName, string> = { FREE: "Free", STARTER: "Starter", PRO: "Pro", ENTERPRISE: "Enterprise" }

// The upgrade path offered to people: Free, then Pro, then Enterprise (Starter is legacy).
function nextPlan(plan: PlanName): PlanName | null {
  if (plan === "FREE" || plan === "STARTER") return "PRO"
  if (plan === "PRO") return "ENTERPRISE"
  return null
}

export type EventLimitCheck = {
  allowed: boolean
  /** events created this calendar month (cancelled and deleted ones left out) */
  used: number
  /** events per month; -1 = unlimited */
  limit: number
  plan: PlanName
  scope: PlanScope
  /** when the monthly count starts again (the 1st of next month) */
  resetsAt: Date
  /** why it isn't allowed and how to get more room; set when allowed is false */
  message?: string
}

export function eventLimitMessage(c: { used: number; limit: number; plan: PlanName; scope: PlanScope; adding: number; resetsAt: Date }): string {
  const across = c.scope.entityType === "enterprise" ? " across your enterprise" : ""
  const created = `You've created ${c.used} of ${c.limit} events this month on the ${PLAN_LABEL[c.plan]} plan${across}`
  const head = c.adding > 1
    ? `${created}, so ${c.adding} more would go over the limit.`
    : `${created}.`
  const resets = `The count resets on ${formatResetDate(c.resetsAt)}.`
  const next = nextPlan(c.plan)
  const nextLimit = next ? PLAN_CONFIG[next].limits.maxEvents : -1
  const upgrade = next ? `upgrade to ${PLAN_LABEL[next]} (${nextLimit === -1 ? "unlimited events" : `${nextLimit} events a month`})` : "upgrade the plan"
  return c.scope.entityType === "enterprise"
    ? `${head} ${resets} To create more now, ask an enterprise admin to ${upgrade}.`
    : `${head} ${resets} To create more now, ${upgrade} from Billing.`
}

/**
 * Whether an organization may create `adding` more events this month. Counts the events
 * created this calendar month (eventsThisMonthWhere) at the level the plan applies to
 * (resolvePlanScope), against the plan that subscription actually entitles (getEntityPlan:
 * a lapsed subscription is FREE). A batch (recurrences) is checked as a whole.
 */
export async function checkEventLimit(orgId: string, adding = 1, now = new Date()): Promise<EventLimitCheck> {
  return checkEventLimitForScope(await resolvePlanScope(orgId), adding, now)
}

/**
 * checkEventLimit for a known plan scope: an enterprise-level event (an enterprise API key
 * creates one with no organization) is checked against the enterprise's plan and count.
 */
export async function checkEventLimitForScope(scope: PlanScope, adding = 1, now = new Date()): Promise<EventLimitCheck> {
  const [plan, used] = await Promise.all([getEntityPlan(scope.entityType, scope.entityId), countEventsThisMonth(scope, now)])
  const limit = PLAN_CONFIG[plan].limits.maxEvents
  const resetsAt = eventLimitResetsAt(now)
  if (limit === -1 || used + adding <= limit) return { allowed: true, used, limit, plan, scope, resetsAt }
  return { allowed: false, used, limit, plan, scope, resetsAt, message: eventLimitMessage({ used, limit, plan, scope, adding, resetsAt }) }
}

export async function checkUsageLimits(entityType: "enterprise" | "org", entityId: string) {
  // Same plan resolution and event count as checkEventLimit, so usage shows what is enforced.
  const plan = await getEntityPlan(entityType, entityId)
  const config = PLAN_CONFIG[plan]

  const [eventCount, memberCount, orgCount] = await Promise.all([
    countEventsThisMonth({ entityType, entityId }),
    entityType === "org"
      ? prisma.organizationMember.count({ where: { organizationId: entityId, isActive: true } })
      : prisma.enterpriseMember.count({ where: { enterpriseId: entityId, isActive: true } }),
    entityType === "enterprise"
      ? prisma.organization.count({ where: { enterpriseId: entityId, isActive: true, deletedAt: null } })
      : Promise.resolve(0),
  ])

  return {
    // events created this month; the count resets on resetsAt
    events: { used: eventCount, limit: config.limits.maxEvents, percentage: config.limits.maxEvents === -1 ? 0 : Math.round((eventCount / config.limits.maxEvents) * 100), resetsAt: eventLimitResetsAt().toISOString() },
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
