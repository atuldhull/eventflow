import { describe, it, expect, beforeEach, vi } from "vitest"

const prismaMock = vi.hoisted(() => ({
  subscription: { findFirst: vi.fn() },
  organization: { findUnique: vi.fn(), count: vi.fn() },
  event: { count: vi.fn() },
  organizationMember: { count: vi.fn() },
  enterpriseMember: { count: vi.fn() },
}))

vi.mock("@/lib/prisma", () => ({
  default: prismaMock,
  prisma: prismaMock,
}))

import { Prisma } from "@prisma/client"
import {
  isPlanSufficient, getEntityPlan, eventsThisMonthWhere, startOfEventMonth, eventLimitResetsAt, checkEventLimit, checkUsageLimits,
} from "@/lib/subscription"

// Saved event templates (Event rows with settings.isTemplate = true) never count. NULL-safe:
// "settings #> '{isTemplate}' IS NULL" OR NOT "= true", so events without settings or
// without the key still count (a bare NOT would drop them: NOT (NULL = true) is NULL).
const NOT_A_TEMPLATE = {
  OR: [
    { settings: { path: ["isTemplate"], equals: Prisma.DbNull } },
    { NOT: { settings: { path: ["isTemplate"], equals: true } } },
  ],
}

const ORG_ID = "org_a"

beforeEach(() => {
  vi.resetAllMocks()
})

describe("isPlanSufficient", () => {
  it("lets any plan use a FREE template", () => {
    expect(isPlanSufficient("FREE", "FREE")).toBe(true)
    expect(isPlanSufficient("PRO", "FREE")).toBe(true)
  })

  it("blocks a FREE org from paid templates", () => {
    expect(isPlanSufficient("FREE", "STARTER")).toBe(false)
    expect(isPlanSufficient("FREE", "PRO")).toBe(false)
    expect(isPlanSufficient("FREE", "ENTERPRISE")).toBe(false)
  })

  it("allows a plan to use its own tier and below, but not above", () => {
    expect(isPlanSufficient("STARTER", "STARTER")).toBe(true)
    expect(isPlanSufficient("STARTER", "PRO")).toBe(false)
    expect(isPlanSufficient("PRO", "STARTER")).toBe(true)
    expect(isPlanSufficient("PRO", "ENTERPRISE")).toBe(false)
    expect(isPlanSufficient("ENTERPRISE", "PRO")).toBe(true)
  })

  it("fails closed on unknown or missing plan names", () => {
    expect(isPlanSufficient("PRO", "GOLD")).toBe(false)
    expect(isPlanSufficient("PRO", null)).toBe(false)
    expect(isPlanSufficient("PRO", undefined)).toBe(false)
    // An unrecognised current plan is treated as FREE, not as a wildcard.
    expect(isPlanSufficient("GOLD", "PRO")).toBe(false)
  })
})

describe("getEntityPlan", () => {
  it("defaults to FREE when the org has no subscription", async () => {
    prismaMock.subscription.findFirst.mockResolvedValue(null)

    await expect(getEntityPlan("org", ORG_ID)).resolves.toBe("FREE")
  })

  it("returns the plan of an active subscription", async () => {
    prismaMock.subscription.findFirst.mockResolvedValue({ plan: "PRO", status: "ACTIVE" })

    await expect(getEntityPlan("org", ORG_ID)).resolves.toBe("PRO")
  })

  it("honours a trial subscription", async () => {
    prismaMock.subscription.findFirst.mockResolvedValue({ plan: "PRO", status: "TRIAL" })

    await expect(getEntityPlan("org", ORG_ID)).resolves.toBe("PRO")
  })

  it("downgrades a cancelled or expired subscription to FREE", async () => {
    prismaMock.subscription.findFirst.mockResolvedValue({ plan: "PRO", status: "CANCELLED" })
    await expect(getEntityPlan("org", ORG_ID)).resolves.toBe("FREE")

    prismaMock.subscription.findFirst.mockResolvedValue({ plan: "PRO", status: "EXPIRED" })
    await expect(getEntityPlan("org", ORG_ID)).resolves.toBe("FREE")

    prismaMock.subscription.findFirst.mockResolvedValue({ plan: "PRO", status: "PAST_DUE" })
    await expect(getEntityPlan("org", ORG_ID)).resolves.toBe("FREE")
  })
})

describe("event limit (N events per month): one rule for create, duplicate, recurrences and billing usage", () => {
  // Built in local time, like the rule itself (server local time).
  const NOW = new Date(2026, 10, 9, 15, 30)
  const MONTH_START = new Date(2026, 10, 1)

  it("counts events created since the 1st of this month, leaving out cancelled and deleted ones and templates", () => {
    expect(eventsThisMonthWhere({ entityType: "org", entityId: ORG_ID }, NOW)).toEqual({
      organizationId: ORG_ID,
      createdAt: { gte: MONTH_START },
      deletedAt: null,
      status: { not: "CANCELLED" },
      AND: [NOT_A_TEMPLATE],
    })
  })

  it("leaves saved event templates out of the count, for the create check and billing usage alike", async () => {
    const notTemplate = (eventsThisMonthWhere({ entityType: "enterprise", entityId: "ent_1" }, NOW).AND as Prisma.EventWhereInput[])[0]
    expect(notTemplate).toEqual(NOT_A_TEMPLATE)
    // DbNull (column / key missing), not JsonNull: toEqual alone can't tell the two apart
    expect((notTemplate.OR as Prisma.EventWhereInput[])[0].settings?.equals).toBe(Prisma.DbNull)

    prismaMock.organization.findUnique.mockResolvedValue({ enterpriseId: null })
    prismaMock.subscription.findFirst.mockResolvedValue(null)
    prismaMock.event.count.mockResolvedValue(0)
    await checkEventLimit(ORG_ID, 1, NOW)
    expect(prismaMock.event.count.mock.calls[0][0].where.AND).toEqual([NOT_A_TEMPLATE])

    prismaMock.organizationMember.count.mockResolvedValue(1)
    await checkUsageLimits("org", ORG_ID)
    expect(prismaMock.event.count.mock.calls[1][0].where.AND).toEqual([NOT_A_TEMPLATE])
  })

  it("starts the month on the 1st and resets on the 1st of next month, across a year end", () => {
    expect(startOfEventMonth(new Date(2026, 11, 31, 23, 59))).toEqual(new Date(2026, 11, 1))
    expect(eventLimitResetsAt(new Date(2026, 11, 31, 23, 59))).toEqual(new Date(2027, 0, 1))
    expect(eventLimitResetsAt(NOW)).toEqual(new Date(2026, 11, 1))
  })

  it("counts an enterprise's events across all of its organizations", () => {
    const where = eventsThisMonthWhere({ entityType: "enterprise", entityId: "ent_1" }, NOW)
    expect(where.OR).toEqual([{ enterpriseId: "ent_1" }, { organization: { enterpriseId: "ent_1" } }])
    expect(where.createdAt).toEqual({ gte: MONTH_START })
    expect(where.status).toEqual({ not: "CANCELLED" })
  })

  it("an enterprise organization uses the enterprise's subscription and the enterprise-wide count", async () => {
    prismaMock.organization.findUnique.mockResolvedValue({ enterpriseId: "ent_1" })
    prismaMock.subscription.findFirst.mockResolvedValue(null) // the enterprise is on FREE
    prismaMock.event.count.mockResolvedValue(4)

    const check = await checkEventLimit(ORG_ID, 1, NOW)

    expect(check).toMatchObject({ allowed: true, used: 4, limit: 5, plan: "FREE", scope: { entityType: "enterprise", entityId: "ent_1" }, resetsAt: new Date(2026, 11, 1) })
    expect(prismaMock.subscription.findFirst).toHaveBeenCalledWith({ where: { enterprise: { id: "ent_1" } } })
    const where = prismaMock.event.count.mock.calls[0][0].where
    expect(where.OR).toEqual([{ enterpriseId: "ent_1" }, { organization: { enterpriseId: "ent_1" } }])
    expect(where.createdAt).toEqual({ gte: MONTH_START })
  })

  it("refuses the event over the limit with the monthly count, the reset date and how to get room", async () => {
    prismaMock.organization.findUnique.mockResolvedValue({ enterpriseId: "ent_1" })
    prismaMock.subscription.findFirst.mockResolvedValue(null)
    prismaMock.event.count.mockResolvedValue(5)

    const check = await checkEventLimit(ORG_ID, 1, NOW)

    expect(check.allowed).toBe(false)
    expect(check.message).toContain("You've created 5 of 5 events this month on the Free plan across your enterprise.")
    expect(check.message).toContain("resets on 1 December 2026")
    expect(check.message).toContain("ask an enterprise admin to upgrade to Pro (unlimited events)")
  })

  it("a standalone organization uses its own subscription; a lapsed paid plan counts as FREE", async () => {
    prismaMock.organization.findUnique.mockResolvedValue({ enterpriseId: null })
    prismaMock.subscription.findFirst.mockResolvedValue({ plan: "STARTER", status: "EXPIRED" })
    prismaMock.event.count.mockResolvedValue(5)

    const check = await checkEventLimit(ORG_ID, 1, NOW)

    expect(prismaMock.subscription.findFirst).toHaveBeenCalledWith({ where: { organizationId: ORG_ID } })
    expect(check).toMatchObject({ allowed: false, plan: "FREE", limit: 5, scope: { entityType: "org", entityId: ORG_ID } })
    expect(check.message).toContain("You've created 5 of 5 events this month on the Free plan.")
    expect(check.message).toContain("upgrade to Pro (unlimited events) from Billing")
  })

  it("checks a batch of new events (recurrences) as a whole", async () => {
    prismaMock.organization.findUnique.mockResolvedValue({ enterpriseId: null })
    prismaMock.subscription.findFirst.mockResolvedValue(null)
    prismaMock.event.count.mockResolvedValue(2)

    await expect(checkEventLimit(ORG_ID, 3, NOW)).resolves.toMatchObject({ allowed: true })
    const over = await checkEventLimit(ORG_ID, 4, NOW)
    expect(over.allowed).toBe(false)
    expect(over.message).toContain("You've created 2 of 5 events this month on the Free plan, so 4 more would go over the limit.")
  })

  it("never limits an unlimited plan", async () => {
    prismaMock.organization.findUnique.mockResolvedValue({ enterpriseId: null })
    prismaMock.subscription.findFirst.mockResolvedValue({ plan: "PRO", status: "ACTIVE" })
    prismaMock.event.count.mockResolvedValue(500)

    await expect(checkEventLimit(ORG_ID)).resolves.toMatchObject({ allowed: true, limit: -1 })
  })

  it("billing usage reports the same monthly count and entitled plan", async () => {
    prismaMock.subscription.findFirst.mockResolvedValue({ plan: "STARTER", status: "CANCELLED" })
    prismaMock.event.count.mockResolvedValue(3)
    prismaMock.enterpriseMember.count.mockResolvedValue(2)
    prismaMock.organization.count.mockResolvedValue(1)

    const usage = await checkUsageLimits("enterprise", "ent_1")

    expect(usage.plan).toBe("FREE")
    expect(usage.events).toMatchObject({ used: 3, limit: 5 })
    const where = prismaMock.event.count.mock.calls[0][0].where
    expect(where.status).toEqual({ not: "CANCELLED" })
    expect(where.deletedAt).toBeNull()
    expect(where.createdAt.gte).toEqual(startOfEventMonth())
    expect(where.endDate).toBeUndefined()
  })
})
