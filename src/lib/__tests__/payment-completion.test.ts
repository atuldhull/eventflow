import { describe, it, expect, beforeEach, vi } from "vitest"

const mocks = vi.hoisted(() => {
  const tx = {
    payment: { updateMany: vi.fn(), findUniqueOrThrow: vi.fn() },
    registration: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
    event: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    ticketType: { findUnique: vi.fn(), updateMany: vi.fn() },
    coupon: { updateMany: vi.fn() },
  }
  return {
    tx,
    prisma: {
      $transaction: vi.fn(),
      ticket: { findFirst: vi.fn() },
      registration: { findUnique: vi.fn() },
    },
    generateTicket: vi.fn(),
  }
})

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }))
vi.mock("@/lib/ticket", () => ({ generateTicket: mocks.generateTicket }))

import { completeRegistrationPayment } from "@/lib/payment-completion"

const FUTURE = new Date(Date.now() + 10 * 60_000).toISOString()
const PAST = new Date(Date.now() - 60_000).toISOString()

function registration(status: string, metadata: Record<string, unknown> = {}) {
  mocks.tx.registration.findUniqueOrThrow.mockResolvedValue({
    id: "reg_1", status, metadata, eventId: "evt_1", ticketTypeId: "tt_1",
  })
  // ensureTicketForRegistration reads the status after the transaction
  mocks.prisma.registration.findUnique.mockResolvedValue({ status: "CONFIRMED" })
}

const seatClaims = () => mocks.tx.event.updateMany.mock.calls.filter(([arg]) => arg.data.currentRegistrations.increment === 1)
const seatReleases = () => mocks.tx.event.updateMany.mock.calls.filter(([arg]) => arg.data.currentRegistrations.decrement === 1)

beforeEach(() => {
  vi.resetAllMocks()
  mocks.prisma.$transaction.mockImplementation((fn: (tx: typeof mocks.tx) => unknown) => fn(mocks.tx))
  mocks.tx.payment.updateMany.mockResolvedValue({ count: 1 })
  mocks.tx.payment.findUniqueOrThrow.mockResolvedValue({ registrationId: "reg_1", couponId: null })
  mocks.tx.event.findUnique.mockResolvedValue({ maxCapacity: 10 })
  mocks.tx.event.updateMany.mockResolvedValue({ count: 1 })
  mocks.tx.event.update.mockResolvedValue({ currentRegistrations: 11, maxCapacity: 10 })
  mocks.tx.ticketType.findUnique.mockResolvedValue({ quantity: null })
  mocks.tx.ticketType.updateMany.mockResolvedValue({ count: 1 })
  mocks.prisma.ticket.findFirst.mockResolvedValue(null)
})

describe("completeRegistrationPayment", () => {
  it("paid within the hold: confirms without counting the seat a second time, issues the ticket", async () => {
    registration("PENDING", { ticketQuantity: 1, holdExpiresAt: FUTURE })

    const result = await completeRegistrationPayment("pmt_1", { gatewayPaymentId: "pay_1" })

    expect(result).toEqual({ completed: true, registrationId: "reg_1", registrationStatus: "CONFIRMED", refundRequired: false })
    expect(mocks.tx.payment.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "pmt_1", status: { in: ["PENDING", "PROCESSING", "FAILED"] } },
      data: expect.objectContaining({ status: "COMPLETED", gatewayPaymentId: "pay_1" }),
    }))
    expect(mocks.tx.registration.update).toHaveBeenCalledWith({
      where: { id: "reg_1" },
      data: expect.objectContaining({ status: "CONFIRMED", metadata: expect.not.objectContaining({ holdExpiresAt: expect.anything() }) }),
    })
    expect(mocks.tx.event.updateMany).not.toHaveBeenCalled()
    expect(mocks.tx.event.update).not.toHaveBeenCalled()
    expect(mocks.tx.ticketType.updateMany).not.toHaveBeenCalled()
    expect(mocks.generateTicket).toHaveBeenCalledWith("reg_1")
  })

  it("an expired hold not yet released still holds the seat (completion won the race)", async () => {
    registration("PENDING", { holdExpiresAt: PAST })

    await completeRegistrationPayment("pmt_1", { gatewayPaymentId: "pay_1" })

    expect(mocks.tx.event.updateMany).not.toHaveBeenCalled()
    expect(mocks.tx.registration.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "CONFIRMED" }) }))
  })

  it("does nothing when another caller (verify vs webhook) already completed it", async () => {
    mocks.tx.payment.updateMany.mockResolvedValue({ count: 0 })

    await expect(completeRegistrationPayment("pmt_1", { gatewayPaymentId: "pay_1" })).resolves.toEqual({ completed: false })

    expect(mocks.tx.registration.update).not.toHaveBeenCalled()
    expect(mocks.tx.event.updateMany).not.toHaveBeenCalled()
    expect(mocks.generateTicket).not.toHaveBeenCalled()
  })

  it("hold expired and released: re-claims seat, stock and coupon use when there is room", async () => {
    mocks.tx.payment.findUniqueOrThrow.mockResolvedValue({ registrationId: "reg_1", couponId: "cpn_1" })
    registration("CANCELLED", { ticketQuantity: 2, holdExpiresAt: PAST, holdReleasedAt: PAST, holdReleasedReason: "expired", stockReleasedAt: PAST, couponReleasedAt: PAST })

    const result = await completeRegistrationPayment("pmt_1", { gatewayPaymentId: "pay_1" })

    expect(result.registrationStatus).toBe("CONFIRMED")
    expect(seatClaims()).toHaveLength(1)
    expect(mocks.tx.event.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "evt_1", currentRegistrations: { lt: 10 } } }))
    expect(mocks.tx.ticketType.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { sold: { increment: 2 } } }))
    expect(mocks.tx.coupon.updateMany).toHaveBeenCalledWith({ where: { id: "cpn_1" }, data: { currentUses: { increment: 1 } } })
    expect(mocks.tx.registration.update).toHaveBeenCalledWith({
      where: { id: "reg_1" },
      data: expect.objectContaining({
        status: "CONFIRMED",
        cancelledAt: null,
        metadata: expect.not.objectContaining({ holdReleasedAt: expect.anything(), stockReleasedAt: expect.anything(), couponReleasedAt: expect.anything() }),
      }),
    })
    expect(mocks.generateTicket).toHaveBeenCalledWith("reg_1")
  })

  it("hold released and the event is full: keeps the payment, waitlists and flags a refund", async () => {
    registration("CANCELLED", { holdExpiresAt: PAST, holdReleasedAt: PAST, holdReleasedReason: "payment_failed", stockReleasedAt: PAST })
    mocks.tx.event.updateMany.mockResolvedValue({ count: 0 })
    mocks.prisma.registration.findUnique.mockResolvedValue({ status: "WAITLISTED" })

    const result = await completeRegistrationPayment("pmt_1", { gatewayPaymentId: "pay_1" })

    expect(result).toMatchObject({ completed: true, registrationStatus: "WAITLISTED", refundRequired: true })
    expect(mocks.tx.ticketType.updateMany).not.toHaveBeenCalled()
    // counted like any waitlisted registration
    expect(mocks.tx.event.update).toHaveBeenCalledWith(expect.objectContaining({ data: { currentRegistrations: { increment: 1 } } }))
    expect(mocks.tx.registration.update).toHaveBeenCalledWith({
      where: { id: "reg_1" },
      // stock stays given back, so a later refund won't return it twice
      data: expect.objectContaining({ status: "WAITLISTED", waitlistPosition: 1, metadata: expect.objectContaining({ refundRequired: true, stockReleasedAt: PAST }) }),
    })
    expect(mocks.generateTicket).not.toHaveBeenCalled()
  })

  it("seat free but ticket type sold out: gives the seat back and flags a refund", async () => {
    registration("CANCELLED", { holdReleasedAt: PAST, holdReleasedReason: "expired", stockReleasedAt: PAST })
    mocks.tx.ticketType.findUnique.mockResolvedValue({ quantity: 5 })
    mocks.tx.ticketType.updateMany.mockResolvedValue({ count: 0 })

    const result = await completeRegistrationPayment("pmt_1", { gatewayPaymentId: "pay_1" })

    expect(result.refundRequired).toBe(true)
    expect(seatClaims()).toHaveLength(1)
    expect(seatReleases()).toHaveLength(1)
  })

  it("a PENDING registration without a hold (pre-hold data) claims its seat conditionally", async () => {
    registration("PENDING", {})

    const result = await completeRegistrationPayment("pmt_1", { gatewayPaymentId: "pay_1" })

    expect(result.registrationStatus).toBe("CONFIRMED")
    expect(seatClaims()).toHaveLength(1)
    expect(mocks.tx.ticketType.updateMany).not.toHaveBeenCalled() // stock was claimed at registration
  })

  it("never resurrects a rejected registration: keeps it, flags the payment for refund", async () => {
    registration("REJECTED", { holdReleasedAt: PAST, holdReleasedReason: "rejected" })
    mocks.prisma.registration.findUnique.mockResolvedValue({ status: "REJECTED" })

    const result = await completeRegistrationPayment("pmt_1", { gatewayPaymentId: "pay_1" })

    expect(result).toMatchObject({ registrationStatus: "REJECTED", refundRequired: true })
    expect(mocks.tx.event.updateMany).not.toHaveBeenCalled()
    expect(mocks.tx.registration.update).toHaveBeenCalledWith({
      where: { id: "reg_1" },
      data: { metadata: expect.objectContaining({ refundRequired: true }) },
    })
    expect(mocks.generateTicket).not.toHaveBeenCalled()
  })
})
