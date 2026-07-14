import { describe, it, expect, beforeEach, vi } from "vitest"

const prismaMock = vi.hoisted(() => ({
  subscription: { findFirst: vi.fn() },
}))

vi.mock("@/lib/prisma", () => ({
  default: prismaMock,
  prisma: prismaMock,
}))

import { isPlanSufficient, getEntityPlan } from "@/lib/subscription"

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
