export const PLANS = {
  FREE: {
    id: "free" as const,
    name: "Free",
    description: "For small clubs and getting started",
    price: { monthly: 0, yearly: 0 },
    limits: {
      maxEventsPerMonth: 5,
      maxParticipantsPerEvent: 100,
      maxOrganizations: 1,
      maxTeamMembers: 5,
      maxStorageGB: 1,
      maxEmailsPerMonth: 500,
      maxApiRequestsPerDay: 0,
      maxWebhooks: 0,
      maxCertificateTemplates: 1,
      maxCouponsPerEvent: 2,
    },
    features: {
      customBranding: false, advancedAnalytics: false, apiAccess: false, webhooks: false,
      whiteLabel: false, customDomain: false, smsNotifications: false, prioritySupport: false,
      certificateCustomTemplates: false, bulkImport: false, exportData: true,
      multiTrackEvents: false, recurringEvents: false, subEvents: false,
      teamRegistration: true, waitlist: true, approvalWorkflow: true, couponCodes: true,
    },
    trialDays: 0,
    isPopular: false,
    ctaText: "Get Started Free",
    badge: null as string | null,
  },
  STARTER: {
    id: "starter" as const,
    name: "Starter",
    description: "For growing organizations",
    price: { monthly: 999, yearly: 9999 },
    limits: {
      maxEventsPerMonth: 25, maxParticipantsPerEvent: 500, maxOrganizations: 3,
      maxTeamMembers: 15, maxStorageGB: 10, maxEmailsPerMonth: 5000,
      maxApiRequestsPerDay: 0, maxWebhooks: 0, maxCertificateTemplates: 5, maxCouponsPerEvent: 10,
    },
    features: {
      customBranding: true, advancedAnalytics: true, apiAccess: false, webhooks: false,
      whiteLabel: false, customDomain: false, smsNotifications: true, prioritySupport: false,
      certificateCustomTemplates: true, bulkImport: true, exportData: true,
      multiTrackEvents: true, recurringEvents: true, subEvents: false,
      teamRegistration: true, waitlist: true, approvalWorkflow: true, couponCodes: true,
    },
    trialDays: 0, isPopular: false, ctaText: "Start with Starter", badge: null as string | null,
  },
  PRO: {
    id: "pro" as const,
    name: "Pro",
    description: "For growing organizations",
    // Matches the public pricing page (₹999 a month, ₹9,999 a year).
    price: { monthly: 999, yearly: 9999 },
    limits: {
      maxEventsPerMonth: -1, maxParticipantsPerEvent: 5000, maxOrganizations: 5,
      maxTeamMembers: 25, maxStorageGB: 50, maxEmailsPerMonth: 25000,
      maxApiRequestsPerDay: 10000, maxWebhooks: 5, maxCertificateTemplates: -1, maxCouponsPerEvent: -1,
    },
    features: {
      customBranding: true, advancedAnalytics: true, apiAccess: true, webhooks: true,
      whiteLabel: false, customDomain: false, smsNotifications: true, prioritySupport: true,
      certificateCustomTemplates: true, bulkImport: true, exportData: true,
      multiTrackEvents: true, recurringEvents: true, subEvents: true,
      teamRegistration: true, waitlist: true, approvalWorkflow: true, couponCodes: true,
    },
    trialDays: 14, isPopular: true, ctaText: "Start 14-Day Free Trial", badge: "Most Popular",
  },
  ENTERPRISE: {
    id: "enterprise" as const,
    name: "Enterprise",
    description: "For universities and large companies",
    price: { monthly: 0, yearly: 0 },
    limits: {
      maxEventsPerMonth: -1, maxParticipantsPerEvent: -1, maxOrganizations: -1,
      maxTeamMembers: -1, maxStorageGB: -1, maxEmailsPerMonth: -1,
      maxApiRequestsPerDay: -1, maxWebhooks: -1, maxCertificateTemplates: -1, maxCouponsPerEvent: -1,
    },
    features: {
      customBranding: true, advancedAnalytics: true, apiAccess: true, webhooks: true,
      whiteLabel: true, customDomain: true, smsNotifications: true, prioritySupport: true,
      certificateCustomTemplates: true, bulkImport: true, exportData: true,
      multiTrackEvents: true, recurringEvents: true, subEvents: true,
      teamRegistration: true, waitlist: true, approvalWorkflow: true, couponCodes: true,
    },
    trialDays: 0, isPopular: false, ctaText: "Contact Sales", badge: null as string | null,
  },
} as const

export type PlanId = keyof typeof PLANS
export type PlanConfig = (typeof PLANS)[PlanId]
export type PlanLimit = keyof typeof PLANS.FREE.limits
export type PlanFeature = keyof typeof PLANS.FREE.features

export function getPlan(planId: PlanId): PlanConfig {
  return PLANS[planId]
}

export function getPlanPrice(planId: PlanId, interval: "monthly" | "yearly"): number {
  return PLANS[planId].price[interval]
}

export function getPlanLimit(planId: PlanId, limit: PlanLimit): number {
  return PLANS[planId].limits[limit]
}

export function hasPlanFeature(planId: PlanId, feature: PlanFeature): boolean {
  return PLANS[planId].features[feature]
}

export function isUnlimited(value: number): boolean {
  return value === -1
}

export function formatLimit(value: number): string {
  if (value === -1) return "Unlimited"
  return value.toLocaleString("en-IN")
}

export function getYearlySavings(planId: PlanId): number {
  const plan = PLANS[planId]
  if (plan.price.monthly === 0) return 0
  const monthlyAnnual = plan.price.monthly * 12
  return Math.round(((monthlyAnnual - plan.price.yearly) / monthlyAnnual) * 100)
}

// The upgrade path offered to people: Free, then Pro, then Enterprise. STARTER is a legacy
// tier kept for existing subscriptions and is no longer offered.
export function getNextPlan(currentPlan: PlanId): PlanId | null {
  if (currentPlan === "FREE" || currentPlan === "STARTER") return "PRO"
  if (currentPlan === "PRO") return "ENTERPRISE"
  return null
}

export function getPreviousPlan(currentPlan: PlanId): PlanId | null {
  const order: PlanId[] = ["FREE", "STARTER", "PRO", "ENTERPRISE"]
  const idx = order.indexOf(currentPlan)
  return idx > 0 ? order[idx - 1] : null
}

export const ALL_PLAN_IDS: PlanId[] = ["FREE", "STARTER", "PRO", "ENTERPRISE"]
