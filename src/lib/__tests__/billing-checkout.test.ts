import crypto from "crypto"
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { NextRequest } from "next/server"

// Route-level tests for plan purchases: paid plans must never activate without a
// verified Razorpay payment. Prisma, auth, RBAC and the Razorpay SDK are stubbed.
const mocks = vi.hoisted(() => ({
  prisma: {
    subscription: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
    enterprise: { update: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
  },
  auth: vi.fn(),
  authorize: vi.fn(),
  createAuditLog: vi.fn(),
  orders: { create: vi.fn(), fetch: vi.fn() },
}))

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }))
vi.mock("@/lib/auth", () => ({ auth: mocks.auth }))
vi.mock("@/lib/authorization", () => ({ authorize: mocks.authorize }))
vi.mock("@/lib/audit", () => ({ createAuditLog: mocks.createAuditLog, getClientInfo: () => ({}) }))
vi.mock("@/lib/razorpay", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/razorpay")>()),
  getRazorpay: () => ({ orders: mocks.orders }),
}))

import { POST as subscribe } from "@/app/api/admin/billing/subscribe/route"
import { POST as verify } from "@/app/api/admin/billing/verify/route"

const USER_ID = "user_1"
const ORG_ID = "org_a"
const KEY_SECRET = "test_key_secret"
const ORDER_ID = "order_plan_1"
const PAYMENT_ID = "pay_plan_1"

const post = (path: string, body: unknown) =>
  new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

const sign = (orderId: string, paymentId: string, secret = KEY_SECRET) =>
  crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex")

const planOrder = (overrides: Partial<{ amount: number; currency: string; notes: Record<string, string> }> = {}) => ({
  id: ORDER_ID,
  amount: 99900,
  currency: "INR",
  status: "paid",
  notes: { purpose: "plan_subscription", entityType: "org", entityId: ORG_ID, plan: "STARTER", billingInterval: "MONTHLY", userId: USER_ID },
  ...overrides,
})

const verifyBody = (overrides: Record<string, unknown> = {}) => ({
  razorpay_order_id: ORDER_ID,
  razorpay_payment_id: PAYMENT_ID,
  razorpay_signature: sign(ORDER_ID, PAYMENT_ID),
  plan: "STARTER",
  billingInterval: "MONTHLY",
  entityType: "org",
  entityId: ORG_ID,
  ...overrides,
})

function expectNoSubscriptionWrites() {
  expect(mocks.prisma.subscription.update).not.toHaveBeenCalled()
  expect(mocks.prisma.subscription.create).not.toHaveBeenCalled()
  expect(mocks.prisma.enterprise.update).not.toHaveBeenCalled()
}

beforeEach(() => {
  vi.resetAllMocks()
  // activatePlan's transaction runs against the same mocked client
  mocks.prisma.$transaction.mockImplementation((fn: (tx: typeof mocks.prisma) => unknown) => fn(mocks.prisma))
  mocks.auth.mockResolvedValue({ user: { id: USER_ID } })
  mocks.authorize.mockResolvedValue({ authorized: true })
  mocks.prisma.subscription.findFirst.mockResolvedValue({ id: "sub_1", plan: "FREE", metadata: null })
  mocks.prisma.subscription.update.mockImplementation(({ data }) => Promise.resolve({ id: "sub_1", ...data }))
  mocks.prisma.subscription.create.mockImplementation(({ data }) => Promise.resolve({ id: "sub_new", ...data }))
  mocks.orders.create.mockResolvedValue({ id: ORDER_ID, amount: 99900, currency: "INR" })
  mocks.orders.fetch.mockResolvedValue(planOrder())
  vi.stubEnv("RAZORPAY_KEY_ID", "rzp_test_key")
  vi.stubEnv("RAZORPAY_KEY_SECRET", KEY_SECRET)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("POST /api/admin/billing/subscribe", () => {
  it("still switches to the FREE plan directly", async () => {
    const res = await subscribe(post("/api/admin/billing/subscribe", { plan: "FREE", entityType: "org", entityId: ORG_ID }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(mocks.prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "sub_1" }, data: expect.objectContaining({ plan: "FREE", status: "ACTIVE", amount: 0 }) })
    )
    expect(mocks.orders.create).not.toHaveBeenCalled()
  })

  it("does not activate a paid plan: it only creates an order priced from server config", async () => {
    const res = await subscribe(post("/api/admin/billing/subscribe", {
      plan: "STARTER", billingInterval: "MONTHLY", entityType: "org", entityId: ORG_ID,
      amount: 1, price: 1, // client-supplied prices must be ignored
    }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data).toMatchObject({ requiresPayment: true, orderId: ORDER_ID, amount: 99900, keyId: "rzp_test_key" })
    expect(mocks.orders.create).toHaveBeenCalledWith(expect.objectContaining({
      amount: 99900,
      currency: "INR",
      notes: expect.objectContaining({ purpose: "plan_subscription", entityType: "org", entityId: ORG_ID, plan: "STARTER", billingInterval: "MONTHLY" }),
    }))
    expectNoSubscriptionWrites()
  })

  it("uses the yearly price for yearly billing", async () => {
    await subscribe(post("/api/admin/billing/subscribe", { plan: "PRO", billingInterval: "YEARLY", entityType: "org", entityId: ORG_ID }))
    expect(mocks.orders.create).toHaveBeenCalledWith(expect.objectContaining({ amount: 999900 }))
    expectNoSubscriptionWrites()
  })

  it("returns 503 and activates nothing when Razorpay is not configured", async () => {
    vi.stubEnv("RAZORPAY_KEY_ID", "")
    vi.stubEnv("RAZORPAY_KEY_SECRET", "")

    const res = await subscribe(post("/api/admin/billing/subscribe", { plan: "PRO", entityType: "org", entityId: ORG_ID }))
    const json = await res.json()

    expect(res.status).toBe(503)
    expect(json).toMatchObject({ success: false, message: "Payments are not configured" })
    expect(mocks.orders.create).not.toHaveBeenCalled()
    expectNoSubscriptionWrites()
  })

  it("refuses the custom-priced ENTERPRISE plan instead of activating it for ₹0", async () => {
    const res = await subscribe(post("/api/admin/billing/subscribe", { plan: "ENTERPRISE", entityType: "org", entityId: ORG_ID }))

    expect(res.status).toBe(400)
    expect(mocks.orders.create).not.toHaveBeenCalled()
    expectNoSubscriptionWrites()
  })

  it("rejects callers without billing permission on the entity", async () => {
    mocks.authorize.mockResolvedValue({ authorized: false, message: "Forbidden" })

    const res = await subscribe(post("/api/admin/billing/subscribe", { plan: "STARTER", entityType: "org", entityId: ORG_ID }))

    expect(res.status).toBe(403)
    expect(mocks.orders.create).not.toHaveBeenCalled()
    expectNoSubscriptionWrites()
  })
})

describe("POST /api/admin/billing/verify", () => {
  it("activates the plan after a valid signature for a matching order", async () => {
    const res = await verify(post("/api/admin/billing/verify", verifyBody()))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(mocks.orders.fetch).toHaveBeenCalledWith(ORDER_ID)
    expect(mocks.prisma.subscription.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "sub_1" },
      data: expect.objectContaining({
        plan: "STARTER",
        status: "ACTIVE",
        amount: 999,
        billingInterval: "MONTHLY",
        metadata: expect.objectContaining({ paidOrderIds: [ORDER_ID] }),
      }),
    }))
    // Serialised per org (row lock) and audited in the same transaction, exactly once.
    expect(mocks.prisma.$queryRaw).toHaveBeenCalledTimes(1)
    expect(mocks.prisma.auditLog.create).toHaveBeenCalledTimes(1)
    expect(mocks.prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: USER_ID, entityType: "ORGANIZATION", entityId: ORG_ID, organizationId: ORG_ID }),
    })
    expect(mocks.createAuditLog).not.toHaveBeenCalled()
  })

  it("checks permission on the entity before anything else", async () => {
    mocks.authorize.mockResolvedValue({ authorized: false, message: "Forbidden" })

    const res = await verify(post("/api/admin/billing/verify", verifyBody()))

    expect(res.status).toBe(403)
    expect(mocks.orders.fetch).not.toHaveBeenCalled()
    expectNoSubscriptionWrites()
  })

  it("rejects an invalid or forged signature", async () => {
    for (const signature of ["deadbeef", sign(ORDER_ID, PAYMENT_ID, "attacker_secret"), sign(ORDER_ID, "pay_other")]) {
      const res = await verify(post("/api/admin/billing/verify", verifyBody({ razorpay_signature: signature })))
      expect(res.status).toBe(400)
    }
    expect(mocks.orders.fetch).not.toHaveBeenCalled()
    expectNoSubscriptionWrites()
  })

  it("rejects a genuine payment whose order belongs to another org", async () => {
    mocks.orders.fetch.mockResolvedValue(planOrder({
      notes: { purpose: "plan_subscription", entityType: "org", entityId: "org_b", plan: "STARTER", billingInterval: "MONTHLY" },
    }))

    const res = await verify(post("/api/admin/billing/verify", verifyBody()))

    expect(res.status).toBe(400)
    expectNoSubscriptionWrites()
  })

  it("rejects a cheaper plan's payment used to claim a pricier plan", async () => {
    // Order was for STARTER; the client claims PRO.
    const res = await verify(post("/api/admin/billing/verify", verifyBody({ plan: "PRO" })))

    expect(res.status).toBe(400)
    expectNoSubscriptionWrites()
  })

  it("rejects a non-plan order (e.g. an event ticket order)", async () => {
    mocks.orders.fetch.mockResolvedValue(planOrder({ notes: { registrationId: "reg_1", eventId: "evt_1", userId: USER_ID } }))

    const res = await verify(post("/api/admin/billing/verify", verifyBody()))

    expect(res.status).toBe(400)
    expectNoSubscriptionWrites()
  })

  it("rejects an order whose amount doesn't match the server price", async () => {
    mocks.orders.fetch.mockResolvedValue(planOrder({ amount: 100 }))

    const res = await verify(post("/api/admin/billing/verify", verifyBody()))

    expect(res.status).toBe(400)
    expectNoSubscriptionWrites()
  })

  it("does not re-activate (extend the period) when the same payment is replayed", async () => {
    mocks.prisma.subscription.findFirst.mockResolvedValue({ id: "sub_1", plan: "STARTER", metadata: { paidOrderIds: [ORDER_ID] } })

    const res = await verify(post("/api/admin/billing/verify", verifyBody()))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.message).toBe("Payment already verified")
    expectNoSubscriptionWrites()
    expect(mocks.prisma.auditLog.create).not.toHaveBeenCalled()
  })

  it("returns 503 and activates nothing when Razorpay is not configured", async () => {
    vi.stubEnv("RAZORPAY_KEY_SECRET", "")

    const res = await verify(post("/api/admin/billing/verify", verifyBody()))

    expect(res.status).toBe(503)
    expectNoSubscriptionWrites()
  })
})
