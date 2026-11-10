import prisma from "@/lib/prisma"
import { PLANS, type PlanId, type PlanLimit, isUnlimited } from "@/config/plans"
import { PLAN_CONFIG, countEventsThisMonth, eventLimitResetsAt, formatResetDate, getEntityPlan } from "@/lib/subscription"

interface UsageItem {
  used: number
  limit: number
  percentage: number
  remaining: number
  /** set on a monthly count (eventsThisMonth): the date it starts again, e.g. "1 December 2026" */
  resetsOn?: string
}

export async function getUsage(entityType: "enterprise" | "org", entityId: string): Promise<Record<string, UsageItem>> {
  // The plan the subscription actually entitles (a lapsed one is FREE), as the limit checks use.
  const planId: PlanId = await getEntityPlan(entityType, entityId)
  const plan = PLANS[planId]

  const [eventsThisMonth, memberCount, orgCount, templateCount, webhookCount] = await Promise.all([
    // The same count the event limit enforces (src/lib/subscription.ts checkEventLimit).
    countEventsThisMonth({ entityType, entityId }),
    entityType === "enterprise"
      ? prisma.enterpriseMember.count({ where: { enterpriseId: entityId, isActive: true } })
      : prisma.organizationMember.count({ where: { organizationId: entityId, isActive: true } }),
    entityType === "enterprise"
      ? prisma.organization.count({ where: { enterpriseId: entityId, isActive: true, deletedAt: null } })
      : Promise.resolve(0),
    entityType === "enterprise"
      ? prisma.certificateTemplate.count({ where: { enterpriseId: entityId } })
      : prisma.certificateTemplate.count({ where: { organizationId: entityId } }),
    entityType === "enterprise"
      ? prisma.webhookEndpoint.count({ where: { enterpriseId: entityId, isActive: true } })
      : prisma.webhookEndpoint.count({ where: { organizationId: entityId, isActive: true } }),
  ])

  function usageItem(used: number, limit: number): UsageItem {
    const isUnl = isUnlimited(limit)
    return {
      used,
      limit,
      percentage: isUnl ? 0 : limit > 0 ? Math.round((used / limit) * 100) : 0,
      remaining: isUnl ? -1 : Math.max(0, limit - used),
    }
  }
  const makeUsageItem = (used: number, limitKey: PlanLimit) => usageItem(used, plan.limits[limitKey])

  return {
    // Events created this month against the limit the create / duplicate check enforces.
    eventsThisMonth: { ...usageItem(eventsThisMonth, PLAN_CONFIG[planId].limits.maxEvents), resetsOn: formatResetDate(eventLimitResetsAt()) },
    organizations: makeUsageItem(orgCount, "maxOrganizations"),
    teamMembers: makeUsageItem(memberCount, "maxTeamMembers"),
    certificateTemplates: makeUsageItem(templateCount, "maxCertificateTemplates"),
    webhooks: makeUsageItem(webhookCount, "maxWebhooks"),
  }
}

export async function checkLimit(
  entityType: "enterprise" | "org",
  entityId: string,
  limitType: PlanLimit
): Promise<{ allowed: boolean; used: number; limit: number; message?: string }> {
  const usage = await getUsage(entityType, entityId)

  const limitKeyMap: Partial<Record<PlanLimit, string>> = {
    maxEventsPerMonth: "eventsThisMonth",
    maxOrganizations: "organizations",
    maxTeamMembers: "teamMembers",
    maxCertificateTemplates: "certificateTemplates",
    maxWebhooks: "webhooks",
  }

  const usageKey = limitKeyMap[limitType]
  if (!usageKey || !usage[usageKey]) return { allowed: true, used: 0, limit: -1 }

  const item = usage[usageKey]
  if (isUnlimited(item.limit)) return { allowed: true, used: item.used, limit: -1 }

  if (item.used >= item.limit) {
    return {
      allowed: false,
      used: item.used,
      limit: item.limit,
      message: `You've reached the limit of ${item.limit} for your current plan. Upgrade to increase your limit.`,
    }
  }

  return { allowed: true, used: item.used, limit: item.limit }
}

export function getUsageAlerts(usage: Record<string, UsageItem>): { limit: string; percentage: number; message: string; severity: "warning" | "danger" | "critical" }[] {
  const alerts: { limit: string; percentage: number; message: string; severity: "warning" | "danger" | "critical" }[] = []

  for (const [key, item] of Object.entries(usage)) {
    if (isUnlimited(item.limit)) continue
    const name = key === "eventsThisMonth" ? "monthly event" : key
    if (item.percentage >= 100) {
      alerts.push({ limit: key, percentage: item.percentage, message: `Reached the ${name} limit (${item.used}/${item.limit})`, severity: "critical" })
    } else if (item.percentage >= 90) {
      alerts.push({ limit: key, percentage: item.percentage, message: `Almost at ${name} limit (${item.used}/${item.limit})`, severity: "danger" })
    } else if (item.percentage >= 80) {
      alerts.push({ limit: key, percentage: item.percentage, message: `Approaching ${name} limit (${item.used}/${item.limit})`, severity: "warning" })
    }
  }

  return alerts
}
