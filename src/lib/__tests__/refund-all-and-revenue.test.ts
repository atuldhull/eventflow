import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

// "Refund all" for a cancelled event refunds each payment on its own (one failure doesn't
// stop the rest), refuses live events, and revenue totals count refunded payments as
// collected with refunds subtracted once.
const mocks = vi.hoisted(() => {
  const tx = { payment: { updateMany: vi.fn() } }
  return {
    tx,
    prisma: {
      payment: { findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn(), aggregate: vi.fn() },
      event: { findFirst: vi.fn() },
      $transaction: vi.fn(),
    },
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

import { POST as refundAllRoute } from "@/app/api/admin/org/[orgId]/events/[eventId]/refund-all/route"
import { refundAllForEvent } from "@/lib/org-refund"
import { revenueTotals, netAmount } from "@/lib/revenue"

const payment = (id: string, overrides: Record<string, unknown> = {}) => ({
  id, amount: 500, currency: "INR", status: "COMPLETED", method: "RAZORPAY", gatewayPaymentId: `pay_${id}`, refundAmount: null,
  userId: "user_1", eventId: "evt_1", registrationId: `reg_${id}`, couponId: null,
  user: { email: "buyer@example.com" }, registration: { event: { title: "Demo Day" } },
  ...overrides,
})

const callRefundAll = () =>
  refundAllRoute(new NextRequest("http://localhost/api/admin/org/org_a/events/evt_1/refund-all", { method: "POST" }), {
    params: Promise.resolve({ orgId: "org_a", eventId: "evt_1" }),
  })

beforeEach(() => {
  vi.resetAllMocks()
  process.env.RAZORPAY_KEY_ID = "rzp_test_x"
  process.env.RAZORPAY_KEY_SECRET = "secret_x"
  mocks.auth.mockResolvedValue({ user: { id: "admin_1" } })
  mocks.authorize.mockResolvedValue({ authorized: true })
  mocks.prisma.$transaction.mockImplementation((fn: (tx: typeof mocks.tx) => unknown) => fn(mocks.tx))
  mocks.tx.payment.updateMany.mockResolvedValue({ count: 1 })
  mocks.sendEmail.mockResolvedValue({ success: true })
})

describe("refundAllForEvent", () => {
  it("refunds each payment in full and keeps going past a Razorpay refusal", async () => {
    mocks.prisma.payment.findMany.mockResolvedValue([{ id: "p1" }, { id: "p2" }, { id: "p3" }])
    mocks.prisma.payment.findFirst.mockImplementation(({ where }: { where: { id: string } }) => Promise.resolve(payment(where.id)))
    mocks.refund.mockImplementation((payId: string) =>
      payId === "pay_p2" ? Promise.reject({ error: { description: "Insufficient balance" } }) : Promise.resolve({ id: `rfnd_${payId}` })
    )
    mocks.prisma.payment.count.mockResolvedValue(1)

    const s = await refundAllForEvent({ orgId: "org_a", eventId: "evt_1", actorId: "admin_1", reason: "Event cancelled" })

    expect(s).toMatchObject({ attempted: 3, refunded: 2, remaining: 1 })
    expect(s.failed).toEqual([{ paymentId: "p2", message: expect.stringContaining("Insufficient balance") }])
    expect(mocks.refund).toHaveBeenCalledWith("pay_p1", expect.objectContaining({ amount: 50000 }))
    expect(mocks.applyFullRefundEffects).toHaveBeenCalledTimes(2)
    // only this organization's payments of this event
    expect(mocks.prisma.payment.findMany.mock.calls[0][0].where).toMatchObject({
      eventId: "evt_1", registration: { event: { organizationId: "org_a" } },
    })
  })

  it("refunds only what is left of a partly refunded payment", async () => {
    mocks.prisma.payment.findMany.mockResolvedValue([{ id: "p1" }])
    mocks.prisma.payment.findFirst.mockResolvedValue(payment("p1", { status: "PARTIALLY_REFUNDED", refundAmount: 200 }))
    mocks.refund.mockResolvedValue({ id: "rfnd_1" })
    mocks.prisma.payment.count.mockResolvedValue(0)

    await refundAllForEvent({ orgId: "org_a", eventId: "evt_1", actorId: "admin_1", reason: "Event cancelled" })

    expect(mocks.refund).toHaveBeenCalledWith("pay_p1", expect.objectContaining({ amount: 30000 }))
    expect(mocks.tx.payment.updateMany.mock.calls[0][0].data).toMatchObject({ status: "REFUNDED", refundAmount: 500 })
  })
})

describe("POST refund-all", () => {
  it("refuses an event that is not cancelled", async () => {
    mocks.prisma.event.findFirst.mockResolvedValue({ status: "PUBLISHED", cancellationReason: null })
    const res = await callRefundAll()
    expect(res.status).toBe(400)
    expect(mocks.prisma.payment.findMany).not.toHaveBeenCalled()
  })

  it("refuses another organization's event and people without payment rights", async () => {
    mocks.prisma.event.findFirst.mockResolvedValue(null)
    expect((await callRefundAll()).status).toBe(404)
    mocks.authorize.mockResolvedValue({ authorized: false, message: "Forbidden" })
    expect((await callRefundAll()).status).toBe(403)
  })

  it("refunds a cancelled event's payments and reports the count", async () => {
    mocks.prisma.event.findFirst.mockResolvedValue({ status: "CANCELLED", cancellationReason: "Rain" })
    mocks.prisma.payment.findMany.mockResolvedValue([{ id: "p1" }])
    mocks.prisma.payment.findFirst.mockResolvedValue(payment("p1"))
    mocks.refund.mockResolvedValue({ id: "rfnd_1" })
    mocks.prisma.payment.count.mockResolvedValue(0)
    const res = await callRefundAll()
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.message).toBe("1 payment refunded")
    expect(mocks.refund.mock.calls[0][1].notes.reason).toBe("Event cancelled: Rain")
  })
})

describe("revenue totals", () => {
  it("counts refunded payments as collected and subtracts refunds once", async () => {
    mocks.prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: 1500, refundAmount: 700 } })
    const t = await revenueTotals({ eventId: "evt_1" })
    expect(t).toEqual({ gross: 1500, refunds: 700, net: 800 })
    expect(mocks.prisma.payment.aggregate.mock.calls[0][0].where.status).toEqual({ in: ["COMPLETED", "PARTIALLY_REFUNDED", "REFUNDED"] })
  })

  it("net of one payment", () => {
    expect(netAmount({ amount: 500, refundAmount: 200 })).toBe(300)
    expect(netAmount({ amount: 500, refundAmount: null })).toBe(500)
  })
})
