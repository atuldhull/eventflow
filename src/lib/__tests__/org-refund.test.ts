import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { NextRequest } from "next/server"

// The organizer refund route must send the money back through Razorpay before it records
// anything; a refund Razorpay refuses changes nothing. Offline payments are only recorded.
const mocks = vi.hoisted(() => {
  const tx = { payment: { updateMany: vi.fn() } }
  return {
    tx,
    prisma: { payment: { findFirst: vi.fn() }, $transaction: vi.fn() },
    auth: vi.fn(),
    authorize: vi.fn(),
    createAuditLog: vi.fn(),
    applyFullRefundEffects: vi.fn(),
    refund: vi.fn(),
    paymentRefunded: vi.fn(),
    sendEmail: vi.fn(),
  }
})

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }))
vi.mock("@/lib/auth", () => ({ auth: mocks.auth }))
vi.mock("@/lib/authorization", () => ({ authorize: mocks.authorize }))
vi.mock("@/lib/audit", () => ({ createAuditLog: mocks.createAuditLog, getClientInfo: () => ({}) }))
vi.mock("@/lib/registration-capacity", () => ({ applyFullRefundEffects: mocks.applyFullRefundEffects }))
vi.mock("@/lib/notifications", () => ({
  notify: { paymentRefunded: mocks.paymentRefunded },
  notifySafely: async (fn: () => Promise<unknown>) => { await fn() },
}))
vi.mock("@/lib/email", () => ({ sendEmail: mocks.sendEmail }))
vi.mock("@/lib/razorpay", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/razorpay")>()),
  getRazorpay: () => ({ payments: { refund: mocks.refund } }),
}))

import { POST as refundRoute } from "@/app/api/admin/org/[orgId]/payments/[paymentId]/refund/route"

const call = (body: unknown = {}) =>
  refundRoute(
    new NextRequest("http://localhost/api/admin/org/org_a/payments/pmt_1/refund", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    { params: Promise.resolve({ orgId: "org_a", paymentId: "pmt_1" }) }
  )

const payment = (overrides: Record<string, unknown> = {}) => ({
  id: "pmt_1", amount: 499, currency: "INR", status: "COMPLETED", method: "RAZORPAY", gatewayPaymentId: "pay_1", refundAmount: null,
  userId: "user_1", eventId: "evt_1", registrationId: "reg_1", couponId: null,
  user: { email: "buyer@example.com" }, registration: { event: { title: "Demo Day" } },
  ...overrides,
})

beforeEach(() => {
  vi.resetAllMocks()
  process.env.RAZORPAY_KEY_ID = "rzp_test_x"
  process.env.RAZORPAY_KEY_SECRET = "secret_x"
  mocks.auth.mockResolvedValue({ user: { id: "admin_1" } })
  mocks.authorize.mockResolvedValue({ authorized: true })
  mocks.prisma.$transaction.mockImplementation((fn: (tx: typeof mocks.tx) => unknown) => fn(mocks.tx))
  mocks.tx.payment.updateMany.mockResolvedValue({ count: 1 })
  mocks.prisma.payment.findFirst.mockResolvedValue(payment())
  mocks.sendEmail.mockResolvedValue({ success: true })
})
afterEach(() => {
  delete process.env.RAZORPAY_KEY_ID
  delete process.env.RAZORPAY_KEY_SECRET
})

describe("organizer refund", () => {
  it("full refund: Razorpay refunds the money first, then the payment, registration and buyer are updated", async () => {
    mocks.refund.mockResolvedValue({ id: "rfnd_1", amount: 49900 })
    const res = await call({ reason: "Event moved" })
    expect(res.status).toBe(200)
    expect(mocks.refund).toHaveBeenCalledWith("pay_1", expect.objectContaining({ amount: 49900 }))
    expect(mocks.tx.payment.updateMany.mock.calls[0][0].data).toMatchObject({ status: "REFUNDED", refundAmount: 499, refundId: "rfnd_1" })
    expect(mocks.applyFullRefundEffects).toHaveBeenCalledTimes(1)
    expect(mocks.paymentRefunded).toHaveBeenCalledWith("user_1", "evt_1", 499, "Demo Day", true)
    expect(mocks.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "buyer@example.com", subject: "Refund processed — Demo Day" }))
  })

  it("Razorpay refusing the refund changes nothing", async () => {
    mocks.refund.mockRejectedValue({ error: { description: "Insufficient balance" } })
    vi.spyOn(console, "error").mockImplementation(() => {})
    const res = await call()
    expect(res.status).toBe(502)
    expect((await res.json()).message).toContain("Insufficient balance")
    expect(mocks.tx.payment.updateMany).not.toHaveBeenCalled()
    expect(mocks.applyFullRefundEffects).not.toHaveBeenCalled()
    expect(mocks.paymentRefunded).not.toHaveBeenCalled()
  })

  it("without gateway keys an online payment is not marked refunded", async () => {
    delete process.env.RAZORPAY_KEY_ID
    const res = await call()
    expect(res.status).toBe(503)
    expect(mocks.refund).not.toHaveBeenCalled()
    expect(mocks.tx.payment.updateMany).not.toHaveBeenCalled()
  })

  it("partial refund keeps the registration", async () => {
    mocks.refund.mockResolvedValue({ id: "rfnd_2" })
    const res = await call({ amount: 100 })
    expect(res.status).toBe(200)
    expect(mocks.refund).toHaveBeenCalledWith("pay_1", expect.objectContaining({ amount: 10000 }))
    expect(mocks.tx.payment.updateMany.mock.calls[0][0].data).toMatchObject({ status: "PARTIALLY_REFUNDED", refundAmount: 100 })
    expect(mocks.applyFullRefundEffects).not.toHaveBeenCalled()
  })

  it("refunding the rest after a partial refund completes it; more than is left is refused", async () => {
    mocks.prisma.payment.findFirst.mockResolvedValue(payment({ status: "PARTIALLY_REFUNDED", refundAmount: 100 }))
    expect((await call({ amount: 400 })).status).toBe(400)
    mocks.refund.mockResolvedValue({ id: "rfnd_3" })
    const res = await call()
    expect(res.status).toBe(200)
    expect(mocks.refund).toHaveBeenCalledWith("pay_1", expect.objectContaining({ amount: 39900 }))
    expect(mocks.tx.payment.updateMany.mock.calls[0][0].data).toMatchObject({ status: "REFUNDED", refundAmount: 499 })
    expect(mocks.applyFullRefundEffects).toHaveBeenCalledTimes(1)
  })

  it("cash payments are recorded without calling Razorpay", async () => {
    mocks.prisma.payment.findFirst.mockResolvedValue(payment({ method: "CASH", gatewayPaymentId: null }))
    const res = await call()
    expect(res.status).toBe(200)
    expect(mocks.refund).not.toHaveBeenCalled()
    expect(mocks.tx.payment.updateMany.mock.calls[0][0].data).toMatchObject({ status: "REFUNDED" })
  })

  it("if Razorpay's webhook recorded the refund first, the call still succeeds and nothing is applied twice", async () => {
    mocks.refund.mockResolvedValue({ id: "rfnd_4" })
    mocks.tx.payment.updateMany.mockResolvedValue({ count: 0 })
    const res = await call()
    expect(res.status).toBe(200)
    expect(mocks.applyFullRefundEffects).not.toHaveBeenCalled()
    expect(mocks.paymentRefunded).not.toHaveBeenCalled()
  })

  it("requires payment-manage permission", async () => {
    mocks.authorize.mockResolvedValue({ authorized: false, message: "Forbidden" })
    expect((await call()).status).toBe(403)
    expect(mocks.refund).not.toHaveBeenCalled()
  })
})
