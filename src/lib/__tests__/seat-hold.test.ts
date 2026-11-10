import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { NextRequest } from "next/server"

// Unit tests for seat-hold release and its routes, with Prisma mocked. The behaviour
// against a real database is covered by seat-hold.db.test.ts (RUN_DB_TESTS=1).
const mocks = vi.hoisted(() => {
  const tx = {
    registration: { findUnique: vi.fn(), updateMany: vi.fn() },
    payment: { updateMany: vi.fn() },
    event: { updateMany: vi.fn() },
    ticketType: { updateMany: vi.fn() },
    coupon: { updateMany: vi.fn() },
  }
  return {
    tx,
    prisma: {
      $transaction: vi.fn(),
      registration: { findMany: vi.fn(), findUniqueOrThrow: vi.fn() },
      payment: { findFirst: vi.fn() },
      event: { findFirst: vi.fn() },
    },
    auth: vi.fn(),
  }
})

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }))
vi.mock("@/lib/auth", () => ({ auth: mocks.auth }))

import { releaseSeatHold, releaseExpiredHolds } from "@/lib/seat-hold"
import { GET as cron } from "@/app/api/cron/release-holds/route"
import { POST as createOrder } from "@/app/api/payments/create-order/route"
import { liveWorkspaceWhere } from "@/lib/public-events"

const FUTURE = new Date(Date.now() + 5 * 60_000).toISOString()
const PAST = new Date(Date.now() - 60_000).toISOString()

function heldRegistration(holdExpiresAt = PAST, extra: Record<string, unknown> = {}) {
  mocks.tx.registration.findUnique.mockResolvedValue({
    id: "reg_1", status: "PENDING", eventId: "evt_1", ticketTypeId: "tt_1",
    metadata: { ticketQuantity: 2, holdExpiresAt },
    payment: { id: "pmt_1", couponId: "cpn_1" },
    ...extra,
  })
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.prisma.$transaction.mockImplementation((fn: (tx: typeof mocks.tx) => unknown) => fn(mocks.tx))
  mocks.tx.payment.updateMany.mockResolvedValue({ count: 1 })
  mocks.tx.registration.updateMany.mockResolvedValue({ count: 1 })
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("releaseSeatHold", () => {
  it("gives back seat, ticket stock and coupon use; cancels the registration; fails the payment", async () => {
    heldRegistration()

    await expect(releaseSeatHold("reg_1", "expired")).resolves.toBe(true)

    expect(mocks.tx.payment.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "pmt_1", status: { in: ["PENDING", "PROCESSING"] } },
      data: expect.objectContaining({ status: "FAILED" }),
    }))
    expect(mocks.tx.registration.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "reg_1", status: "PENDING" },
      data: expect.objectContaining({ status: "CANCELLED", metadata: expect.objectContaining({ holdReleasedReason: "expired" }) }),
    }))
    expect(mocks.tx.event.updateMany).toHaveBeenCalledWith({ where: { id: "evt_1", currentRegistrations: { gt: 0 } }, data: { currentRegistrations: { decrement: 1 } } })
    expect(mocks.tx.ticketType.updateMany).toHaveBeenCalledWith({ where: { id: "tt_1", sold: { gte: 2 } }, data: { sold: { decrement: 2 } } })
    expect(mocks.tx.coupon.updateMany).toHaveBeenCalledWith({ where: { id: "cpn_1", currentUses: { gt: 0 } }, data: { currentUses: { decrement: 1 } } })
  })

  it("does nothing when the payment completed first", async () => {
    heldRegistration()
    mocks.tx.payment.updateMany.mockResolvedValue({ count: 0 }) // neither open nor FAILED any more

    await expect(releaseSeatHold("reg_1", "expired")).resolves.toBe(false)

    expect(mocks.tx.registration.updateMany).not.toHaveBeenCalled()
    expect(mocks.tx.event.updateMany).not.toHaveBeenCalled()
  })

  it("is idempotent: a registration that's no longer held is left alone", async () => {
    heldRegistration(PAST, { status: "CANCELLED", metadata: { holdExpiresAt: PAST, holdReleasedAt: PAST } })

    await expect(releaseSeatHold("reg_1", "expired")).resolves.toBe(false)

    expect(mocks.tx.payment.updateMany).not.toHaveBeenCalled()
  })

  it("an 'expired' release skips a hold that was renewed after it was picked", async () => {
    heldRegistration(FUTURE)

    await expect(releaseSeatHold("reg_1", "expired", { onlyIfExpiredBy: new Date() })).resolves.toBe(false)

    expect(mocks.tx.payment.updateMany).not.toHaveBeenCalled()
  })

  it("a concurrent release that already flipped the registration rolls this one back", async () => {
    heldRegistration()
    mocks.tx.registration.updateMany.mockResolvedValue({ count: 0 })

    await expect(releaseSeatHold("reg_1", "expired")).resolves.toBe(false)

    expect(mocks.tx.event.updateMany).not.toHaveBeenCalled()
  })
})

describe("releaseExpiredHolds", () => {
  it("only selects PENDING registrations whose hold expiry has passed", async () => {
    mocks.prisma.registration.findMany.mockResolvedValue([])
    const now = new Date()

    await releaseExpiredHolds({ eventId: "evt_1", now })

    expect(mocks.prisma.registration.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: "PENDING", metadata: { path: ["holdExpiresAt"], lt: now.toISOString() }, eventId: "evt_1" },
    }))
  })
})

describe("GET /api/cron/release-holds", () => {
  const call = (auth?: string) =>
    cron(new NextRequest("http://localhost/api/cron/release-holds", { headers: auth ? { authorization: auth } : {} }))

  it("refuses without the CRON_SECRET bearer token", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret")

    expect((await call()).status).toBe(401)
    expect((await call("Bearer wrong")).status).toBe(401)
    expect(mocks.prisma.registration.findMany).not.toHaveBeenCalled()
  })

  it("is disabled when CRON_SECRET isn't set", async () => {
    vi.stubEnv("CRON_SECRET", "")

    expect((await call("Bearer ")).status).toBe(500)
    expect(mocks.prisma.registration.findMany).not.toHaveBeenCalled()
  })

  it("releases expired holds and reports the count", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret")
    mocks.prisma.registration.findMany.mockResolvedValue([{ id: "reg_1" }])
    heldRegistration()

    const res = await call("Bearer s3cret")

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ success: true, data: { released: 1, failed: 0 } })
  })
})

describe("POST /api/payments/create-order", () => {
  const order = () => createOrder(new NextRequest("http://localhost/api/payments/create-order", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ registrationId: "reg_1" }),
  }))

  beforeEach(() => {
    mocks.auth.mockResolvedValue({ user: { id: "user_1" } })
    mocks.prisma.payment.findFirst.mockResolvedValue({
      id: "pmt_1", status: "PENDING", amount: 500, currency: "INR", paymentNumber: "PAY-1", gatewayOrderId: null,
      registration: { event: { id: "evt_1", title: "Event", isPaid: true } },
    })
    mocks.prisma.event.findFirst.mockResolvedValue({ id: "evt_1" })
  })

  it("answers 503 'Payments are not configured' without touching the hold", async () => {
    vi.stubEnv("RAZORPAY_KEY_ID", "")
    vi.stubEnv("RAZORPAY_KEY_SECRET", "")

    const res = await order()

    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ success: false, message: "Payments are not configured" })
    expect(mocks.prisma.registration.findMany).not.toHaveBeenCalled()
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled()
  })

  it("answers 404 'Event not found' when the event's organization or enterprise is no longer live", async () => {
    mocks.prisma.event.findFirst.mockResolvedValue(null)

    const res = await order()

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ success: false, message: "Event not found" })
    expect(mocks.prisma.event.findFirst.mock.calls[0][0].where).toMatchObject({ id: "evt_1", deletedAt: null, ...liveWorkspaceWhere() })
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled()
  })
})
