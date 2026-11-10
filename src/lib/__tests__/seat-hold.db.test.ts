import crypto from "crypto"
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest"
import { NextRequest } from "next/server"

// Seat holds for paid registrations, against a real Postgres (the one in DATABASE_URL).
// Opt-in, because CI has no database:
//   RUN_DB_TESTS=1 npx vitest run src/lib/__tests__/seat-hold.db.test.ts
// Razorpay is never called: the client is stubbed and signatures are computed here.
// Every record created here is removed in afterAll.
const RUN = process.env.RUN_DB_TESTS === "1"

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  apiCtx: { organizationId: "" as string | null },
  orders: { create: vi.fn(), fetch: vi.fn() },
}))
vi.mock("@/lib/auth", () => ({ auth: mocks.auth }))
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn() }))
vi.mock("@/lib/audit", () => ({
  createAuditLog: vi.fn(),
  getClientInfo: () => ({ ipAddress: "127.0.0.1", userAgent: "vitest" }),
}))
vi.mock("@/lib/authorization", () => ({ authorize: vi.fn(async () => ({ authorized: true })) }))
vi.mock("@/lib/api-auth", () => ({
  withApiAuth: (_scope: string, handler: (req: NextRequest, ctx: unknown, routeCtx: unknown) => unknown) =>
    (req: NextRequest, routeCtx: unknown) =>
      handler(req, { apiKeyId: "test", userId: "", organizationId: mocks.apiCtx.organizationId, scopes: [] }, routeCtx),
}))
vi.mock("@/lib/razorpay", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/razorpay")>()),
  getRazorpay: () => ({ orders: mocks.orders }),
}))

import prisma from "@/lib/prisma"
import * as registrationsRoute from "@/app/api/registrations/route"
import * as cancelRoute from "@/app/api/registrations/[registrationId]/cancel/route"
import * as createOrderRoute from "@/app/api/payments/create-order/route"
import * as verifyRoute from "@/app/api/payments/verify/route"
import * as cronRoute from "@/app/api/cron/release-holds/route"
import * as webhookRoute from "@/app/api/webhooks/razorpay/route"
import * as statusRoute from "@/app/api/admin/org/[orgId]/registrations/[registrationId]/status/route"
import * as v1Route from "@/app/api/v1/events/[eventId]/registrations/route"
import * as refundRoute from "@/app/api/admin/org/[orgId]/payments/[paymentId]/refund/route"
import { completeRegistrationPayment } from "@/lib/payment-completion"
import { activatePlan } from "@/lib/billing"
import { releaseSeatHold } from "@/lib/seat-hold"

const RUN_ID = `hold${Date.now().toString(36)}`
const CRON_SECRET = "test_cron_secret"
const WEBHOOK_SECRET = "test_webhook_secret"
const KEY_SECRET = "test_key_secret"
const createdEventIds: string[] = []
let orgId = ""
let seq = 0

type EventOpts = { maxCapacity?: number | null; waitlistEnabled?: boolean; approvalRequired?: boolean; price?: number; ticketQuantity?: number | null }

async function createEvent(name: string, opts: EventOpts = {}) {
  // The oldest user (seed data), never a user another test file is about to delete.
  const creator = await prisma.user.findFirstOrThrow({ orderBy: { createdAt: "asc" }, select: { id: true } })
  const price = opts.price ?? 500
  const event = await prisma.event.create({
    data: {
      title: `${RUN_ID} ${name}`,
      slug: `${RUN_ID}-${name}-${seq++}`,
      description: "Seat hold test event (auto-deleted)",
      startDate: new Date(Date.now() + 7 * 86400000),
      endDate: new Date(Date.now() + 8 * 86400000),
      status: "PUBLISHED",
      maxCapacity: opts.maxCapacity === undefined ? 1 : opts.maxCapacity,
      waitlistEnabled: opts.waitlistEnabled ?? false,
      approvalRequired: opts.approvalRequired ?? false,
      isPaid: price > 0,
      organizationId: orgId,
      createdById: creator.id,
    },
  })
  createdEventIds.push(event.id)
  const ticketType = await prisma.ticketType.create({
    data: { eventId: event.id, name: "General", price, quantity: opts.ticketQuantity ?? null, maxPerUser: 5 },
  })
  return { eventId: event.id, ticketTypeId: ticketType.id }
}

const json = (body: unknown) => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })

async function register(eventId: string, ticketTypeId: string, who = `u${seq++}`, extra: Record<string, unknown> = {}) {
  mocks.auth.mockResolvedValue(null)
  const email = `${RUN_ID}-${who}@hold.test`
  const res = await registrationsRoute.POST(new NextRequest("http://localhost/api/registrations", json({
    eventId, ticketTypeId, quantity: 1, guestEmail: email, guestName: who, ...extra,
  })))
  const body = await res.json()
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  return { status: res.status, body, userId: user?.id ?? "", registrationId: body.data?.registration?.id as string }
}

async function state(eventId: string, ticketTypeId: string, registrationId?: string) {
  const [event, ticketType, registration, payment] = await Promise.all([
    prisma.event.findUniqueOrThrow({ where: { id: eventId }, select: { currentRegistrations: true } }),
    prisma.ticketType.findUniqueOrThrow({ where: { id: ticketTypeId }, select: { sold: true } }),
    registrationId ? prisma.registration.findUnique({ where: { id: registrationId }, select: { status: true, metadata: true, waitlistPosition: true } }) : null,
    registrationId ? prisma.payment.findUnique({ where: { registrationId }, select: { id: true, status: true } }) : null,
  ])
  return {
    seats: event.currentRegistrations,
    sold: ticketType.sold,
    status: registration?.status,
    meta: (registration?.metadata ?? {}) as Record<string, unknown>,
    payment: payment?.status,
    paymentId: payment?.id ?? "",
  }
}

async function expireHold(registrationId: string) {
  const reg = await prisma.registration.findUniqueOrThrow({ where: { id: registrationId }, select: { metadata: true } })
  await prisma.registration.update({
    where: { id: registrationId },
    data: { metadata: { ...(reg.metadata as object), holdExpiresAt: new Date(Date.now() - 60_000).toISOString() } },
  })
}

const cron = (secret: string | null = CRON_SECRET) =>
  cronRoute.GET(new NextRequest("http://localhost/api/cron/release-holds", { headers: secret ? { authorization: `Bearer ${secret}` } : {} }))

function webhook(event: unknown) {
  const body = JSON.stringify(event)
  const signature = crypto.createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex")
  return webhookRoute.POST(new NextRequest("http://localhost/api/webhooks/razorpay", {
    method: "POST", headers: { "content-type": "application/json", "x-razorpay-signature": signature }, body,
  }))
}

// One cleanup after every describe block below has run.
afterAll(async () => {
  if (!RUN) return
  if (createdEventIds.length) {
    const where = { eventId: { in: createdEventIds } }
    await prisma.ticket.deleteMany({ where })
    await prisma.payment.deleteMany({ where })
    await prisma.registration.deleteMany({ where })
    await prisma.coupon.deleteMany({ where })
    await prisma.ticketType.deleteMany({ where })
    await prisma.event.deleteMany({ where: { id: { in: createdEventIds } } })
  }
  // Notifications cascade with the users.
  await prisma.user.deleteMany({ where: { email: { startsWith: `${RUN_ID}-` } } })
})

describe.runIf(RUN)("seat holds for paid registrations", () => {
  beforeAll(async () => {
    vi.stubEnv("CRON_SECRET", CRON_SECRET)
    vi.stubEnv("RAZORPAY_WEBHOOK_SECRET", WEBHOOK_SECRET)
    vi.stubEnv("TICKET_SECRET", "t".repeat(40))
    const org = await prisma.organization.findFirstOrThrow({ select: { id: true } })
    orgId = org.id
    mocks.apiCtx.organizationId = orgId
  })

  afterEach(() => {
    vi.stubEnv("RAZORPAY_KEY_ID", "")
    vi.stubEnv("RAZORPAY_KEY_SECRET", "")
  })

  afterAll(() => {
    vi.unstubAllEnvs()
  })

  it("claims the seat and ticket stock at creation and records a 15-minute hold", async () => {
    const { eventId, ticketTypeId } = await createEvent("claim", { maxCapacity: 2 })

    const before = Date.now()
    const { status, body, registrationId } = await register(eventId, ticketTypeId)
    const s = await state(eventId, ticketTypeId, registrationId)

    expect(status).toBe(201)
    expect(s).toMatchObject({ seats: 1, sold: 1, status: "PENDING", payment: "PENDING" })
    const expiresAt = new Date(String(s.meta.holdExpiresAt)).getTime()
    expect(expiresAt).toBeGreaterThanOrEqual(before + 15 * 60_000 - 1000)
    expect(expiresAt).toBeLessThanOrEqual(Date.now() + 15 * 60_000 + 1000)
    expect(body.data.holdExpiresAt).toBe(s.meta.holdExpiresAt)
  })

  it("a paid registration that hits a full, waitlisted event is waitlisted without a hold", async () => {
    const { eventId, ticketTypeId } = await createEvent("waitlist", { maxCapacity: 1, waitlistEnabled: true })
    await register(eventId, ticketTypeId)

    const second = await register(eventId, ticketTypeId)
    const s = await state(eventId, ticketTypeId, second.registrationId)

    expect(s).toMatchObject({ seats: 2, status: "WAITLISTED" })
    expect(s.meta.holdExpiresAt).toBeUndefined()
  })

  it("cron releases an expired hold once; requires the cron secret", async () => {
    const { eventId, ticketTypeId } = await createEvent("cron")
    const { registrationId } = await register(eventId, ticketTypeId)
    await expireHold(registrationId)

    expect((await cron(null)).status).toBe(401)
    expect((await cron("wrong")).status).toBe(401)
    expect(await state(eventId, ticketTypeId, registrationId)).toMatchObject({ seats: 1, sold: 1, status: "PENDING" })

    const first = await (await cron()).json()
    const s = await state(eventId, ticketTypeId, registrationId)
    expect(first.success).toBe(true)
    expect(first.data.released).toBeGreaterThanOrEqual(1)
    expect(s).toMatchObject({ seats: 0, sold: 0, status: "CANCELLED", payment: "FAILED" })
    expect(s.meta).toMatchObject({ holdReleasedReason: "expired" })

    await cron()
    expect(await state(eventId, ticketTypeId, registrationId)).toMatchObject({ seats: 0, sold: 0, status: "CANCELLED" })
  })

  it("does not release a hold that hasn't expired", async () => {
    const { eventId, ticketTypeId } = await createEvent("fresh")
    const { registrationId } = await register(eventId, ticketTypeId)

    await cron()

    expect(await state(eventId, ticketTypeId, registrationId)).toMatchObject({ seats: 1, status: "PENDING", payment: "PENDING" })
  })

  it("POST /api/registrations lazily releases an expired hold on a full event", async () => {
    const { eventId, ticketTypeId } = await createEvent("lazy")
    const a = await register(eventId, ticketTypeId)
    expect((await register(eventId, ticketTypeId)).body.message).toBe("Event is full")

    await expireHold(a.registrationId)
    const b = await register(eventId, ticketTypeId)

    expect(b.status).toBe(201)
    expect((await state(eventId, ticketTypeId, a.registrationId)).status).toBe("CANCELLED")
    expect(await state(eventId, ticketTypeId, b.registrationId)).toMatchObject({ seats: 1, sold: 1, status: "PENDING" })
  })

  it("paying within the hold confirms without counting the seat twice and issues the ticket", async () => {
    const { eventId, ticketTypeId } = await createEvent("paid")
    const { registrationId } = await register(eventId, ticketTypeId)
    const { paymentId } = await state(eventId, ticketTypeId, registrationId)

    const result = await completeRegistrationPayment(paymentId, { gatewayPaymentId: `pay_${RUN_ID}_1` })
    const again = await completeRegistrationPayment(paymentId, { gatewayPaymentId: `pay_${RUN_ID}_1` })

    expect(result).toMatchObject({ completed: true, registrationStatus: "CONFIRMED", refundRequired: false })
    expect(again.completed).toBe(false)
    const s = await state(eventId, ticketTypeId, registrationId)
    expect(s).toMatchObject({ seats: 1, sold: 1, status: "CONFIRMED", payment: "COMPLETED" })
    expect(s.meta.holdExpiresAt).toBeUndefined()
    expect(await prisma.ticket.count({ where: { registrationId } })).toBe(1)
  })

  it("a payment after the hold was released re-claims the seat when one is free", async () => {
    const { eventId, ticketTypeId } = await createEvent("reclaim")
    const { registrationId } = await register(eventId, ticketTypeId)
    await expireHold(registrationId)
    await cron()
    const { paymentId } = await state(eventId, ticketTypeId, registrationId)

    const result = await completeRegistrationPayment(paymentId, { gatewayPaymentId: `pay_${RUN_ID}_2` })

    expect(result.registrationStatus).toBe("CONFIRMED")
    expect(await state(eventId, ticketTypeId, registrationId)).toMatchObject({ seats: 1, sold: 1, status: "CONFIRMED", payment: "COMPLETED" })
  })

  it("a payment after the seat went to someone else is kept, waitlisted and flagged for refund", async () => {
    const { eventId, ticketTypeId } = await createEvent("lost")
    const a = await register(eventId, ticketTypeId)
    await expireHold(a.registrationId)
    const b = await register(eventId, ticketTypeId) // lazily releases A, takes the seat
    const { paymentId } = await state(eventId, ticketTypeId, a.registrationId)

    const result = await completeRegistrationPayment(paymentId, { gatewayPaymentId: `pay_${RUN_ID}_3` })

    expect(result).toMatchObject({ completed: true, registrationStatus: "WAITLISTED", refundRequired: true })
    const s = await state(eventId, ticketTypeId, a.registrationId)
    expect(s).toMatchObject({ status: "WAITLISTED", payment: "COMPLETED", seats: 2, sold: 1 })
    expect(s.meta.refundRequired).toBe(true)
    expect((await state(eventId, ticketTypeId, b.registrationId)).status).toBe("PENDING")
    expect(await prisma.ticket.count({ where: { registrationId: a.registrationId } })).toBe(0)
  })

  it("a release racing a payment completion never double-counts or loses the seat", async () => {
    for (let i = 0; i < 6; i++) {
      const { eventId, ticketTypeId } = await createEvent(`race${i}`)
      const { registrationId } = await register(eventId, ticketTypeId)
      await expireHold(registrationId)
      const { paymentId } = await state(eventId, ticketTypeId, registrationId)

      await Promise.all([
        releaseSeatHold(registrationId, "expired"),
        completeRegistrationPayment(paymentId, { gatewayPaymentId: `pay_${RUN_ID}_race${i}` }),
      ])

      expect(await state(eventId, ticketTypeId, registrationId)).toMatchObject({ seats: 1, sold: 1, status: "CONFIRMED", payment: "COMPLETED" })
    }
  })

  it("the payment.failed webhook releases the hold", async () => {
    const { eventId, ticketTypeId } = await createEvent("failed")
    const { registrationId } = await register(eventId, ticketTypeId)
    const orderId = `order_${RUN_ID}_failed`
    await prisma.payment.update({ where: { registrationId }, data: { gatewayOrderId: orderId } })

    const res = await webhook({ event: "payment.failed", payload: { payment: { entity: { id: `pay_${RUN_ID}_f`, order_id: orderId, error_description: "Card declined" } } } })

    expect(res.status).toBe(200)
    const s = await state(eventId, ticketTypeId, registrationId)
    expect(s).toMatchObject({ seats: 0, sold: 0, status: "CANCELLED", payment: "FAILED" })
    expect(s.meta.holdReleasedReason).toBe("payment_failed")
  })

  it("cancelling a held registration releases the hold", async () => {
    const { eventId, ticketTypeId } = await createEvent("cancel")
    const { registrationId, userId } = await register(eventId, ticketTypeId)
    mocks.auth.mockResolvedValue({ user: { id: userId } })

    const res = await cancelRoute.POST(new NextRequest(`http://localhost/api/registrations/${registrationId}/cancel`, { method: "POST" }), { params: Promise.resolve({ registrationId }) })
    const again = await cancelRoute.POST(new NextRequest(`http://localhost/api/registrations/${registrationId}/cancel`, { method: "POST" }), { params: Promise.resolve({ registrationId }) })

    expect(res.status).toBe(200)
    expect(again.status).toBe(400)
    expect(await state(eventId, ticketTypeId, registrationId)).toMatchObject({ seats: 0, sold: 0, status: "CANCELLED", payment: "FAILED" })
  })

  it("create-order answers 503 when payments aren't configured and leaves the hold alone", async () => {
    const { eventId, ticketTypeId } = await createEvent("noconfig")
    const { registrationId, userId } = await register(eventId, ticketTypeId)
    mocks.auth.mockResolvedValue({ user: { id: userId } })

    const res = await createOrderRoute.POST(new NextRequest("http://localhost/api/payments/create-order", json({ registrationId })))

    expect(res.status).toBe(503)
    expect(await res.json()).toMatchObject({ success: false, message: "Payments are not configured" })
    expect(await state(eventId, ticketTypeId, registrationId)).toMatchObject({ seats: 1, status: "PENDING" })
  })

  it("create-order re-holds an expired registration, then checkout + verify confirms it", async () => {
    vi.stubEnv("RAZORPAY_KEY_ID", "rzp_test_key")
    vi.stubEnv("RAZORPAY_KEY_SECRET", KEY_SECRET)
    const orderId = `order_${RUN_ID}_rehold`
    mocks.orders.create.mockResolvedValue({ id: orderId, amount: 50000, currency: "INR" })
    const { eventId, ticketTypeId } = await createEvent("rehold")
    const { registrationId, userId } = await register(eventId, ticketTypeId)
    await expireHold(registrationId)
    mocks.auth.mockResolvedValue({ user: { id: userId } })

    const res = await createOrderRoute.POST(new NextRequest("http://localhost/api/payments/create-order", json({ registrationId })))
    const order = await res.json()

    expect(res.status).toBe(200)
    expect(order.data).toMatchObject({ orderId, amount: 50000, keyId: "rzp_test_key" })
    expect(new Date(order.data.holdExpiresAt).getTime()).toBeGreaterThan(Date.now() + 14 * 60_000)
    expect(await state(eventId, ticketTypeId, registrationId)).toMatchObject({ seats: 1, sold: 1, status: "PENDING", payment: "PENDING" })

    const paymentId = `pay_${RUN_ID}_rehold`
    const signature = crypto.createHmac("sha256", KEY_SECRET).update(`${orderId}|${paymentId}`).digest("hex")
    const verified = await (await verifyRoute.POST(new NextRequest("http://localhost/api/payments/verify", json({
      razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature,
    })))).json()

    expect(verified).toMatchObject({ success: true, data: { registrationStatus: "CONFIRMED", refundRequired: false } })
    expect(verified.data.ticket?.qrCode).toBeTruthy()
    expect(await state(eventId, ticketTypeId, registrationId)).toMatchObject({ seats: 1, sold: 1, status: "CONFIRMED", payment: "COMPLETED" })
  })

  it("create-order refuses to re-hold when the event filled up meanwhile", async () => {
    vi.stubEnv("RAZORPAY_KEY_ID", "rzp_test_key")
    vi.stubEnv("RAZORPAY_KEY_SECRET", KEY_SECRET)
    const { eventId, ticketTypeId } = await createEvent("refull")
    const a = await register(eventId, ticketTypeId)
    await expireHold(a.registrationId)
    await register(eventId, ticketTypeId)
    mocks.auth.mockResolvedValue({ user: { id: a.userId } })

    const res = await createOrderRoute.POST(new NextRequest("http://localhost/api/payments/create-order", json({ registrationId: a.registrationId })))

    expect(res.status).toBe(409)
    expect(await state(eventId, ticketTypeId, a.registrationId)).toMatchObject({ seats: 1, sold: 1, status: "CANCELLED", payment: "FAILED" })
  })

  it("a full refund.processed cancels registration and ticket and returns the seat exactly once", async () => {
    const { eventId, ticketTypeId } = await createEvent("refund")
    const { registrationId } = await register(eventId, ticketTypeId)
    const { paymentId } = await state(eventId, ticketTypeId, registrationId)
    const gatewayPaymentId = `pay_${RUN_ID}_refund`
    await completeRegistrationPayment(paymentId, { gatewayPaymentId })
    const refund = (id: string) => ({
      event: "refund.processed",
      payload: {
        refund: { entity: { id, payment_id: gatewayPaymentId, amount: 50000 } },
        payment: { entity: { id: gatewayPaymentId, amount: 50000, amount_refunded: 50000 } },
      },
    })

    expect((await webhook(refund(`rfnd_${RUN_ID}_1`))).status).toBe(200)
    await webhook(refund(`rfnd_${RUN_ID}_1`)) // redelivery
    await webhook(refund(`rfnd_${RUN_ID}_2`)) // a second refund event for the same payment

    expect(await state(eventId, ticketTypeId, registrationId)).toMatchObject({ seats: 0, status: "CANCELLED", payment: "REFUNDED" })
    expect((await prisma.ticket.findFirstOrThrow({ where: { registrationId } })).status).toBe("CANCELLED")
  })
})

describe.runIf(RUN)("approval and API registrations claim seats conditionally", () => {
  beforeAll(async () => {
    const org = await prisma.organization.findFirstOrThrow({ select: { id: true } })
    orgId = org.id
    mocks.apiCtx.organizationId = orgId
  })

  const approve = (registrationId: string, status = "CONFIRMED") => {
    mocks.auth.mockResolvedValue({ user: { id: "admin-test" } })
    return statusRoute.PATCH(
      new NextRequest(`http://localhost/api/admin/org/${orgId}/registrations/${registrationId}/status`, { ...json({ status }), method: "PATCH" }),
      { params: Promise.resolve({ orgId, registrationId }) }
    )
  }

  it("approving on a full event returns 'Event is full' instead of overbooking", async () => {
    const { eventId, ticketTypeId } = await createEvent("approve", { approvalRequired: true, price: 0, maxCapacity: 1 })
    const a = await register(eventId, ticketTypeId)
    const b = await register(eventId, ticketTypeId)
    expect([a.body.data.registration.status, b.body.data.registration.status]).toEqual(["PENDING", "PENDING"])
    expect((await state(eventId, ticketTypeId)).seats).toBe(0)

    const [ra, rb] = await Promise.all([approve(a.registrationId), approve(b.registrationId)])
    const bodies = await Promise.all([ra.json(), rb.json()])

    expect(bodies.filter((x) => x.success)).toHaveLength(1)
    expect(bodies.find((x) => !x.success)).toMatchObject({ message: "Event is full" })
    expect((await state(eventId, ticketTypeId)).seats).toBe(1)
    const statuses = (await prisma.registration.findMany({ where: { eventId }, select: { status: true } })).map((r) => r.status).sort()
    expect(statuses).toEqual(["CONFIRMED", "PENDING"])
  })

  it("rejecting a held paid registration releases its hold", async () => {
    const { eventId, ticketTypeId } = await createEvent("reject")
    const { registrationId } = await register(eventId, ticketTypeId)

    const res = await approve(registrationId, "REJECTED")

    expect(res.status).toBe(200)
    expect(await state(eventId, ticketTypeId, registrationId)).toMatchObject({ seats: 0, sold: 0, status: "REJECTED", payment: "FAILED" })
  })

  it("the in-app refund applies its effects once even when submitted twice at the same time", async () => {
    const { eventId, ticketTypeId } = await createEvent("inapprefund", { maxCapacity: 3 })
    const { registrationId } = await register(eventId, ticketTypeId)
    const { paymentId } = await state(eventId, ticketTypeId, registrationId)
    await completeRegistrationPayment(paymentId, { gatewayPaymentId: `pay_${RUN_ID}_inapp` })
    mocks.auth.mockResolvedValue({ user: { id: "admin-test" } })
    const refund = () => refundRoute.POST(
      new NextRequest(`http://localhost/api/admin/org/${orgId}/payments/${paymentId}/refund`, json({ reason: "test" })),
      { params: Promise.resolve({ orgId, paymentId }) }
    )

    const statuses = (await Promise.all([refund(), refund()])).map((r) => r.status).sort()

    expect(statuses).toEqual([200, 400])
    expect(await state(eventId, ticketTypeId, registrationId)).toMatchObject({ seats: 0, status: "CANCELLED", payment: "REFUNDED" })
    expect((await prisma.ticket.findFirstOrThrow({ where: { registrationId } })).status).toBe("CANCELLED")
  })

  it("parallel v1 API registrations never exceed capacity", async () => {
    const { eventId } = await createEvent("v1", { price: 0, maxCapacity: 2 })

    const responses = await Promise.all(Array.from({ length: 8 }, (_, i) =>
      v1Route.POST(
        new NextRequest(`http://localhost/api/v1/events/${eventId}/registrations`, json({ participantEmail: `${RUN_ID}-v1-${i}@hold.test`, participantName: `API ${i}` })),
        { params: Promise.resolve({ eventId }) }
      )
    ))
    const results = await Promise.all(responses.map(async (r) => ({ status: r.status, body: await r.json() })))

    expect(results.filter((r) => r.status === 201)).toHaveLength(2)
    expect(results.filter((r) => r.body.error?.message === "Event is full")).toHaveLength(6)
    const event = await prisma.event.findUniqueOrThrow({ where: { id: eventId } })
    expect(event.currentRegistrations).toBe(2)
    expect(await prisma.registration.count({ where: { eventId, status: "CONFIRMED" } })).toBe(2)
  })
})

describe.runIf(RUN)("tickets on approval, stock returns and registering again", () => {
  beforeAll(async () => {
    const org = await prisma.organization.findFirstOrThrow({ select: { id: true } })
    orgId = org.id
  })

  const setStatus = (registrationId: string, status: string) => {
    mocks.auth.mockResolvedValue({ user: { id: "admin-test" } })
    return statusRoute.PATCH(
      new NextRequest(`http://localhost/api/admin/org/${orgId}/registrations/${registrationId}/status`, { ...json({ status }), method: "PATCH" }),
      { params: Promise.resolve({ orgId, registrationId }) }
    )
  }
  const cancel = (registrationId: string, userId: string) => {
    mocks.auth.mockResolvedValue({ user: { id: userId } })
    return cancelRoute.POST(new NextRequest(`http://localhost/api/registrations/${registrationId}/cancel`, { method: "POST" }), { params: Promise.resolve({ registrationId }) })
  }
  const refund = (paymentId: string) => {
    mocks.auth.mockResolvedValue({ user: { id: "admin-test" } })
    return refundRoute.POST(
      new NextRequest(`http://localhost/api/admin/org/${orgId}/payments/${paymentId}/refund`, json({ reason: "test" })),
      { params: Promise.resolve({ orgId, paymentId }) }
    )
  }
  const couponUses = async (code: string) => (await prisma.coupon.findUniqueOrThrow({ where: { code } })).currentUses

  it("approving a free registration issues its ticket the way a free confirmed one gets it", async () => {
    const { eventId, ticketTypeId } = await createEvent("approveticket", { approvalRequired: true, price: 0, maxCapacity: 5 })
    const { registrationId } = await register(eventId, ticketTypeId)
    expect(await prisma.ticket.count({ where: { registrationId } })).toBe(0)

    expect((await setStatus(registrationId, "CONFIRMED")).status).toBe(200)

    const ticket = await prisma.ticket.findUniqueOrThrow({ where: { registrationId } })
    expect(ticket).toMatchObject({ status: "ACTIVE", ticketTypeId })
    expect(ticket.ticketNumber).toMatch(/^TKT-/)
    expect(ticket.qrCode).toMatch(/^EVF-/)
  })

  it("rejecting returns the ticket stock exactly once, and voids the ticket", async () => {
    const { eventId, ticketTypeId } = await createEvent("rejectstock", { approvalRequired: true, price: 0, maxCapacity: 5 })
    const { registrationId } = await register(eventId, ticketTypeId)
    await setStatus(registrationId, "CONFIRMED")
    expect(await state(eventId, ticketTypeId)).toMatchObject({ seats: 1, sold: 1 })

    await setStatus(registrationId, "REJECTED")
    await setStatus(registrationId, "REJECTED")
    await setStatus(registrationId, "CANCELLED")

    expect(await state(eventId, ticketTypeId, registrationId)).toMatchObject({ seats: 0, sold: 0, status: "CANCELLED" })
    expect((await prisma.ticket.findUniqueOrThrow({ where: { registrationId } })).status).toBe("CANCELLED")
  })

  it("cancel then refund returns seat, ticket stock and coupon use exactly once", async () => {
    const { eventId, ticketTypeId } = await createEvent("cancelrefund", { maxCapacity: 5 })
    const code = `${RUN_ID}-CR`.toUpperCase()
    await prisma.coupon.create({ data: { code, eventId, discountType: "PERCENTAGE", discountValue: 10, maxUses: 5, validFrom: new Date(Date.now() - 86400000), validUntil: new Date(Date.now() + 86400000) } })
    const { registrationId, userId } = await register(eventId, ticketTypeId, undefined, { couponCode: code })
    const { paymentId } = await state(eventId, ticketTypeId, registrationId)
    await completeRegistrationPayment(paymentId, { gatewayPaymentId: `pay_${RUN_ID}_cr` })
    expect(await state(eventId, ticketTypeId)).toMatchObject({ seats: 1, sold: 1 })
    expect(await couponUses(code)).toBe(1)

    expect((await cancel(registrationId, userId)).status).toBe(200)
    expect((await refund(paymentId)).status).toBe(200)

    expect(await state(eventId, ticketTypeId, registrationId)).toMatchObject({ seats: 0, sold: 0, status: "CANCELLED", payment: "REFUNDED" })
    expect(await couponUses(code)).toBe(0)
  })

  it("registering again after an expired hold reuses the registration with a fresh hold", async () => {
    const { eventId, ticketTypeId } = await createEvent("rereg-hold", { maxCapacity: 1 })
    const first = await register(eventId, ticketTypeId, "again1")
    const firstPayment = await state(eventId, ticketTypeId, first.registrationId)
    await expireHold(first.registrationId)

    const second = await register(eventId, ticketTypeId, "again1")

    expect(second.status).toBe(201)
    expect(second.registrationId).toBe(first.registrationId)
    expect(second.body.data.registrationNumber).toBe(first.body.data.registrationNumber)
    const s = await state(eventId, ticketTypeId, second.registrationId)
    expect(s).toMatchObject({ seats: 1, sold: 1, status: "PENDING", payment: "PENDING", paymentId: firstPayment.paymentId })
    expect(new Date(String(s.meta.holdExpiresAt)).getTime()).toBeGreaterThan(Date.now() + 14 * 60_000)
    expect(s.meta.stockReleasedAt).toBeUndefined()
  })

  it("registering again after cancelling a free registration re-activates its ticket", async () => {
    const { eventId, ticketTypeId } = await createEvent("rereg-free", { price: 0, maxCapacity: 5 })
    const first = await register(eventId, ticketTypeId, "again2")
    const ticketId = first.body.data.ticket.id
    await cancel(first.registrationId, first.userId)
    expect(await state(eventId, ticketTypeId)).toMatchObject({ seats: 0, sold: 0 })

    const second = await register(eventId, ticketTypeId, "again2")

    expect(second.status).toBe(201)
    expect(second.body.data.registration.status).toBe("CONFIRMED")
    expect(second.body.data.ticket.id).toBe(ticketId)
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })).status).toBe("ACTIVE")
    expect(await state(eventId, ticketTypeId)).toMatchObject({ seats: 1, sold: 1 })
  })

  it("registering again waits for a held payment to be refunded, then works", async () => {
    const { eventId, ticketTypeId } = await createEvent("rereg-paid", { maxCapacity: 5 })
    const first = await register(eventId, ticketTypeId, "again3")
    const { paymentId } = await state(eventId, ticketTypeId, first.registrationId)
    await completeRegistrationPayment(paymentId, { gatewayPaymentId: `pay_${RUN_ID}_rr` })
    await cancel(first.registrationId, first.userId)

    const blocked = await register(eventId, ticketTypeId, "again3")
    expect(blocked.status).toBe(409)
    expect(blocked.body.message).toMatch(/refunded yet/)

    await refund(paymentId)
    const again = await register(eventId, ticketTypeId, "again3")

    expect(again.status).toBe(201)
    expect(again.registrationId).toBe(first.registrationId)
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } })
    expect(payment).toMatchObject({ status: "PENDING", refundId: null, gatewayPaymentId: null })
    expect((payment.metadata as { history: { status: string }[] }).history.map((h) => h.status)).toEqual(["REFUNDED"])
    expect(await state(eventId, ticketTypeId)).toMatchObject({ seats: 1, sold: 1 })
  })

  it("two attempts racing to reuse the same cancelled registration: one wins, the other gets 409", async () => {
    const { eventId, ticketTypeId } = await createEvent("rereg-race", { price: 0, maxCapacity: 5 })
    const first = await register(eventId, ticketTypeId, "again4")
    await cancel(first.registrationId, first.userId)

    const results = await Promise.all([register(eventId, ticketTypeId, "again4"), register(eventId, ticketTypeId, "again4")])

    expect(results.map((r) => r.status).sort()).toEqual([201, 409])
    expect(await state(eventId, ticketTypeId)).toMatchObject({ seats: 1, sold: 1 })
  })

  it("concurrent plan activations for one payment activate and audit exactly once", async () => {
    const org = await prisma.organization.create({ data: { name: `${RUN_ID} billing org`, slug: `${RUN_ID}-billing`, email: `${RUN_ID}-org@hold.test` } })
    const actor = await prisma.user.findFirstOrThrow({ orderBy: { createdAt: "asc" }, select: { id: true } })
    try {
      const activate = () => activatePlan({
        entityType: "org", entityId: org.id, plan: "STARTER", billingInterval: "MONTHLY",
        payment: { orderId: `order_${RUN_ID}_plan`, paymentId: `pay_${RUN_ID}_plan` },
        audit: { userId: actor.id, description: "test activation" },
      })

      const results = await Promise.all([activate(), activate(), activate()])

      expect(results.filter((r) => !r.alreadyApplied)).toHaveLength(1)
      expect(await prisma.auditLog.count({ where: { entityId: org.id } })).toBe(1)
      const subs = await prisma.subscription.findMany({ where: { organizationId: org.id } })
      expect(subs).toHaveLength(1)
      expect((subs[0].metadata as { paidOrderIds: string[] }).paidOrderIds).toEqual([`order_${RUN_ID}_plan`])
    } finally {
      await prisma.auditLog.deleteMany({ where: { entityId: org.id } })
      await prisma.subscription.deleteMany({ where: { organizationId: org.id } })
      await prisma.organization.delete({ where: { id: org.id } })
    }
  })
})
