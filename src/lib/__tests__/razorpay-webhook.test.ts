import crypto from "crypto"
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  prisma: {
    payment: { findFirst: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
    user: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
  completeRegistrationPayment: vi.fn(),
  releaseSeatHold: vi.fn(),
  applyFullRefundEffects: vi.fn(),
  activatePlan: vi.fn(),
  createAuditLog: vi.fn(),
  orders: { fetch: vi.fn() },
}))

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }))
vi.mock("@/lib/payment-completion", () => ({ completeRegistrationPayment: mocks.completeRegistrationPayment }))
vi.mock("@/lib/seat-hold", () => ({ releaseSeatHold: mocks.releaseSeatHold }))
vi.mock("@/lib/registration-capacity", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/registration-capacity")>()),
  applyFullRefundEffects: mocks.applyFullRefundEffects,
}))
vi.mock("@/lib/audit", () => ({ createAuditLog: mocks.createAuditLog }))
vi.mock("@/lib/billing", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/billing")>()),
  activatePlan: mocks.activatePlan,
}))
vi.mock("@/lib/razorpay", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/razorpay")>()),
  getRazorpay: () => ({ orders: mocks.orders }),
}))

import { POST as webhook } from "@/app/api/webhooks/razorpay/route"

const WEBHOOK_SECRET = "test_webhook_secret"

const sign = (body: string, secret = WEBHOOK_SECRET) =>
  crypto.createHmac("sha256", secret).update(body).digest("hex")

function deliver(event: unknown, { signature, rawBody }: { signature?: string | null; rawBody?: string } = {}) {
  const body = rawBody ?? JSON.stringify(event)
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  const sig = signature === undefined ? sign(body) : signature
  if (sig !== null) headers["x-razorpay-signature"] = sig
  return webhook(new NextRequest("http://localhost/api/webhooks/razorpay", { method: "POST", headers, body }))
}

const captured = (amount = 50000) => ({
  event: "payment.captured",
  payload: { payment: { entity: { id: "pay_1", order_id: "order_1", amount, currency: "INR", status: "captured" } } },
})

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv("RAZORPAY_WEBHOOK_SECRET", WEBHOOK_SECRET)
  mocks.prisma.payment.updateMany.mockResolvedValue({ count: 1 })
  // The refund handler runs in a transaction; the tx is the same mocked client.
  mocks.prisma.$transaction.mockImplementation((fn: (tx: typeof mocks.prisma) => unknown) => fn(mocks.prisma))
  mocks.completeRegistrationPayment.mockResolvedValue({ completed: true })
  mocks.releaseSeatHold.mockResolvedValue(true)
  mocks.activatePlan.mockResolvedValue({ subscription: { id: "sub_1" }, alreadyApplied: false })
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("POST /api/webhooks/razorpay — authentication", () => {
  it("returns 503 when the webhook secret is not configured", async () => {
    vi.stubEnv("RAZORPAY_WEBHOOK_SECRET", "")

    const res = await deliver(captured())

    expect(res.status).toBe(503)
    expect(mocks.prisma.payment.findFirst).not.toHaveBeenCalled()
  })

  it("returns 400 when the signature header is missing", async () => {
    const res = await deliver(captured(), { signature: null })

    expect(res.status).toBe(400)
    expect(mocks.prisma.payment.findFirst).not.toHaveBeenCalled()
  })

  it("returns 400 when the body was tampered with after signing", async () => {
    const original = JSON.stringify(captured(50000))
    const tampered = JSON.stringify(captured(100))

    const res = await deliver(null, { rawBody: tampered, signature: sign(original) })

    expect(res.status).toBe(400)
    expect(mocks.completeRegistrationPayment).not.toHaveBeenCalled()
  })

  it("returns 400 for a signature made with the wrong secret", async () => {
    const body = JSON.stringify(captured())

    const res = await deliver(null, { rawBody: body, signature: sign(body, "wrong_secret") })

    expect(res.status).toBe(400)
  })

  it("acknowledges unknown events with 200 and touches nothing", async () => {
    const res = await deliver({ event: "settlement.processed", payload: {} })

    expect(res.status).toBe(200)
    expect(mocks.prisma.payment.findFirst).not.toHaveBeenCalled()
    expect(mocks.prisma.payment.updateMany).not.toHaveBeenCalled()
  })
})

describe("POST /api/webhooks/razorpay — payment events", () => {
  it("payment.captured completes the matching pending registration payment", async () => {
    mocks.prisma.payment.findFirst.mockResolvedValue({ id: "pmt_1", amount: 500, status: "PENDING" })

    const res = await deliver(captured())

    expect(res.status).toBe(200)
    expect(mocks.prisma.payment.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { gatewayOrderId: "order_1" } }))
    expect(mocks.completeRegistrationPayment).toHaveBeenCalledWith("pmt_1", { gatewayPaymentId: "pay_1" })
  })

  it("payment.captured is a no-op for an already completed payment", async () => {
    mocks.prisma.payment.findFirst.mockResolvedValue({ id: "pmt_1", amount: 500, status: "COMPLETED" })

    const res = await deliver(captured())

    expect(res.status).toBe(200)
    expect(mocks.completeRegistrationPayment).not.toHaveBeenCalled()
  })

  it("payment.captured does not complete a payment whose amount doesn't match", async () => {
    mocks.prisma.payment.findFirst.mockResolvedValue({ id: "pmt_1", amount: 500, status: "PENDING" })
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})

    const res = await deliver(captured(100))

    expect(res.status).toBe(200)
    expect(mocks.completeRegistrationPayment).not.toHaveBeenCalled()
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it("payment.captured for an order with no Payment row is acknowledged when it isn't a plan order", async () => {
    mocks.prisma.payment.findFirst.mockResolvedValue(null)
    vi.stubEnv("RAZORPAY_KEY_ID", "rzp_test_key")
    vi.stubEnv("RAZORPAY_KEY_SECRET", "test_key_secret")
    mocks.orders.fetch.mockResolvedValue({ id: "order_1", amount: 50000, currency: "INR", notes: [] })

    const res = await deliver(captured())

    expect(res.status).toBe(200)
    expect(mocks.completeRegistrationPayment).not.toHaveBeenCalled()
    expect(mocks.activatePlan).not.toHaveBeenCalled()
  })

  it("payment.failed only fails still-open payments and releases the seat hold", async () => {
    mocks.prisma.payment.findFirst.mockResolvedValue({ registrationId: "reg_1" })

    const res = await deliver({
      event: "payment.failed",
      payload: { payment: { entity: { id: "pay_1", order_id: "order_1", error_description: "Card declined" } } },
    })

    expect(res.status).toBe(200)
    expect(mocks.prisma.payment.updateMany).toHaveBeenCalledWith({
      where: { gatewayOrderId: "order_1", status: { in: ["PENDING", "PROCESSING"] } },
      data: expect.objectContaining({ status: "FAILED", failureReason: "Card declined" }),
    })
    expect(mocks.releaseSeatHold).toHaveBeenCalledWith("reg_1", "payment_failed")
  })

  it("refund.processed records a full refund and cancels the registration like the in-app refund", async () => {
    mocks.prisma.payment.findFirst.mockResolvedValue({ id: "pmt_1", amount: 500, status: "COMPLETED", refundId: null, refundAmount: null, registrationId: "reg_1", couponId: "cpn_1" })

    const res = await deliver({
      event: "refund.processed",
      payload: {
        refund: { entity: { id: "rfnd_1", payment_id: "pay_1", amount: 50000 } },
        payment: { entity: { id: "pay_1", order_id: "order_1", amount: 50000, amount_refunded: 50000 } },
      },
    })

    expect(res.status).toBe(200)
    expect(mocks.prisma.payment.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: "pmt_1", status: { in: ["COMPLETED", "PARTIALLY_REFUNDED"] } }),
      data: expect.objectContaining({ status: "REFUNDED", refundId: "rfnd_1", refundAmount: 500 }),
    }))
    expect(mocks.applyFullRefundEffects).toHaveBeenCalledWith(mocks.prisma, expect.objectContaining({ registrationId: "reg_1", couponId: "cpn_1" }))
  })

  it("refund.processed applies the full-refund effects only once (guarded update matched nothing)", async () => {
    mocks.prisma.payment.findFirst.mockResolvedValue({ id: "pmt_1", amount: 500, status: "COMPLETED", refundId: null, refundAmount: null, registrationId: "reg_1", couponId: null })
    mocks.prisma.payment.updateMany.mockResolvedValue({ count: 0 })

    await deliver({
      event: "refund.processed",
      payload: { refund: { entity: { id: "rfnd_2", payment_id: "pay_1", amount: 50000 } } },
    })

    expect(mocks.applyFullRefundEffects).not.toHaveBeenCalled()
  })

  it("refund.processed records a partial refund", async () => {
    mocks.prisma.payment.findFirst.mockResolvedValue({ id: "pmt_1", amount: 500, status: "COMPLETED", refundId: null, refundAmount: null })

    await deliver({
      event: "refund.processed",
      payload: { refund: { entity: { id: "rfnd_1", payment_id: "pay_1", amount: 20000 } } },
    })

    expect(mocks.prisma.payment.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "PARTIALLY_REFUNDED", refundAmount: 200 }),
    }))
    expect(mocks.applyFullRefundEffects).not.toHaveBeenCalled()
  })

  it("refund.processed is idempotent on redelivery", async () => {
    mocks.prisma.payment.findFirst.mockResolvedValue({ id: "pmt_1", amount: 500, status: "REFUNDED", refundId: "rfnd_1", refundAmount: 500 })

    const res = await deliver({
      event: "refund.processed",
      payload: { refund: { entity: { id: "rfnd_1", payment_id: "pay_1", amount: 50000 } } },
    })

    expect(res.status).toBe(200)
    expect(mocks.prisma.payment.updateMany).not.toHaveBeenCalled()
  })

  it("returns 500 so Razorpay retries when processing throws", async () => {
    mocks.prisma.payment.findFirst.mockRejectedValue(new Error("db down"))
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})

    const res = await deliver(captured())

    expect(res.status).toBe(500)
    spy.mockRestore()
  })
})

describe("POST /api/webhooks/razorpay — plan purchases", () => {
  const planNotes = { purpose: "plan_subscription", entityType: "org", entityId: "org_a", plan: "STARTER", billingInterval: "MONTHLY", userId: "user_1" }
  const planOrder = (overrides: Record<string, unknown> = {}) => ({ id: "order_plan", amount: 99900, currency: "INR", status: "paid", notes: planNotes, ...overrides })
  const orderPaid = (order: unknown, amount = 99900) => ({
    event: "order.paid",
    payload: {
      payment: { entity: { id: "pay_plan", order_id: "order_plan", amount, currency: "INR", status: "captured" } },
      order: { entity: order },
    },
  })

  beforeEach(() => {
    mocks.prisma.payment.findFirst.mockResolvedValue(null)
    mocks.prisma.user.findUnique.mockResolvedValue({ id: "user_1" })
  })

  it("order.paid activates the plan with the same idempotent activatePlan as verify, audited inside it", async () => {
    const res = await deliver(orderPaid(planOrder()))

    expect(res.status).toBe(200)
    expect(mocks.activatePlan).toHaveBeenCalledWith({
      entityType: "org", entityId: "org_a", plan: "STARTER", billingInterval: "MONTHLY",
      payment: { orderId: "order_plan", paymentId: "pay_plan" },
      audit: expect.objectContaining({ userId: "user_1" }),
    })
    // The audit entry is written in activatePlan's transaction, never separately.
    expect(mocks.createAuditLog).not.toHaveBeenCalled()
    expect(mocks.orders.fetch).not.toHaveBeenCalled()
  })

  it("activates without an audit actor when the buyer no longer exists", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(null)

    await deliver(orderPaid(planOrder()))

    expect(mocks.activatePlan).toHaveBeenCalledWith(expect.not.objectContaining({ audit: expect.anything() }))
  })

  it("flags a capture on a gateway order that a re-registration replaced", async () => {
    mocks.prisma.payment.findFirst
      .mockResolvedValueOnce(null) // no payment with this order id any more
      .mockResolvedValueOnce({ id: "pmt_old", metadata: { previousOrderIds: ["order_1"] } })
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})

    const res = await deliver(captured())

    expect(res.status).toBe(200)
    expect(mocks.prisma.payment.update).toHaveBeenCalledWith({
      where: { id: "pmt_old" },
      data: { metadata: expect.objectContaining({ refundRequired: true, supersededCaptures: [expect.objectContaining({ orderId: "order_1", paymentId: "pay_1" })] }) },
    })
    expect(mocks.activatePlan).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it("payment.captured (no order in the payload) fetches the order to read its notes", async () => {
    vi.stubEnv("RAZORPAY_KEY_ID", "rzp_test_key")
    vi.stubEnv("RAZORPAY_KEY_SECRET", "test_key_secret")
    mocks.orders.fetch.mockResolvedValue(planOrder())

    const res = await deliver({
      event: "payment.captured",
      payload: { payment: { entity: { id: "pay_plan", order_id: "order_plan", amount: 99900, currency: "INR" } } },
    })

    expect(res.status).toBe(200)
    expect(mocks.orders.fetch).toHaveBeenCalledWith("order_plan")
    expect(mocks.activatePlan).toHaveBeenCalledWith(expect.objectContaining({ plan: "STARTER", payment: { orderId: "order_plan", paymentId: "pay_plan" } }))
  })

  it("a redelivery after verify already activated it changes nothing and writes no audit log", async () => {
    mocks.activatePlan.mockResolvedValue({ subscription: { id: "sub_1" }, alreadyApplied: true })

    const res = await deliver(orderPaid(planOrder()))

    expect(res.status).toBe(200)
    expect(mocks.createAuditLog).not.toHaveBeenCalled()
  })

  it("refuses a plan order whose amount doesn't match the server-side price", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})

    const res = await deliver(orderPaid(planOrder({ amount: 100 }), 100))

    expect(res.status).toBe(200)
    expect(mocks.activatePlan).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it("refuses a plan order with tampered or unknown notes", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})

    await deliver(orderPaid(planOrder({ notes: { ...planNotes, plan: "FREE" } })))
    await deliver(orderPaid(planOrder({ notes: { ...planNotes, entityType: "user" } })))

    expect(mocks.activatePlan).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it("acknowledges without activating when the order can't be looked up (keys not configured)", async () => {
    // explicit, so keys in a developer's .env can't change the outcome
    vi.stubEnv("RAZORPAY_KEY_ID", "")
    vi.stubEnv("RAZORPAY_KEY_SECRET", "")
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {})

    const res = await deliver(captured())

    expect(res.status).toBe(200)
    expect(mocks.activatePlan).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it("returns 500 (Razorpay retries) when the order lookup fails", async () => {
    vi.stubEnv("RAZORPAY_KEY_ID", "rzp_test_key")
    vi.stubEnv("RAZORPAY_KEY_SECRET", "test_key_secret")
    mocks.orders.fetch.mockRejectedValue(new Error("network"))
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})

    const res = await deliver(captured())

    expect(res.status).toBe(500)
    spy.mockRestore()
  })
})
