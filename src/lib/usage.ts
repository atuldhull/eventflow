import prisma from "@/lib/prisma"
import { PLANS, type PlanId, type PlanLimit, isUnlimited } from "@/config/plans"

interface UsageItem {
  used: number
  limit: number
  percentage: number
  remaining: number
}

export async function getUsage(entityType: "enterprise" | "org", entityId: string): Promise<Record<string, UsageItem>> {
  // Get subscription plan
  const subscription = entityType === "enterprise"
    ? await prisma.subscription.findFirst({ where: { enterprise: { id: entityId } } })
    : await prisma.subscription.findFirst({ where: { organizationId: entityId } })

  const planId = (subscription?.plan as PlanId) || "FREE"
  const plan = PLANS[planId]

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  // Calculate each usage metric
  const eventFilter = entityType === "enterprise"
    ? { OR: [{ enterpriseId: entityId }, { organization: { enterpriseId: entityId } }] as any }
    : { organizationId: entityId }

  const [eventsThisMonth, memberCount, orgCount, templateCount, webhookCount] = await Promise.all([
    prisma.event.count({ where: { ...eventFilter, deletedAt: null, createdAt: { gte: monthStart } } }),
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

  function makeUsageItem(used: number, limitKey: PlanLimit): UsageItem {
    const limit = plan.limits[limitKey]
    const isUnl = isUnlimited(limit)
    return {
      used,
      limit,
      percentage: isUnl ? 0 : limit > 0 ? Math.round((used / limit) * 100) : 0,
      remaining: isUnl ? -1 : Math.max(0, limit - used),
    }
  }

  return {
    eventsThisMonth: makeUsageItem(eventsThisMonth, "maxEventsPerMonth"),
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
    if (item.percentage >= 100) {
      alerts.push({ limit: key, percentage: item.percentage, message: `${key} limit reached (${item.used}/${item.limit})`, severity: "critical" })
    } else if (item.percentage >= 90) {
      alerts.push({ limit: key, percentage: item.percentage, message: `Almost at ${key} limit (${item.used}/${item.limit})`, severity: "danger" })
    } else if (item.percentage >= 80) {
      alerts.push({ limit: key, percentage: item.percentage, message: `Approaching ${key} limit (${item.used}/${item.limit})`, severity: "warning" })
    }
  }

  return alerts
}
