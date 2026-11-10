import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

// Guest checkout on POST /api/registrations: a signed-out visitor may take a free ticket
// on a public event; paid tickets and private events need an account. Prisma, auth and the
// capacity/ticket helpers are stubbed.
const mocks = vi.hoisted(() => ({
  prisma: {
    user: { findUnique: vi.fn(), upsert: vi.fn() },
    event: { findUnique: vi.fn() },
    ticketType: { findFirst: vi.fn() },
    registration: { findUnique: vi.fn() },
    organizationMember: { findFirst: vi.fn() },
    enterpriseMember: { findFirst: vi.fn() },
    coupon: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
  tx: { registration: { create: vi.fn(), update: vi.fn() }, payment: { create: vi.fn() } },
  auth: vi.fn(),
  claim: vi.fn(),
  issueFreeTicket: vi.fn(),
  ip: { value: "203.0.113.1" },
}))

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }))
vi.mock("@/lib/auth", () => ({ auth: mocks.auth }))
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn(), getClientInfo: () => ({ ipAddress: mocks.ip.value, userAgent: "test" }) }))
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn().mockResolvedValue({ success: true }) }))
vi.mock("@/lib/seat-hold", () => ({ newHoldExpiry: () => new Date(), releaseExpiredHolds: vi.fn() }))
vi.mock("@/lib/registration-ticket", () => ({ issueFreeTicket: mocks.issueFreeTicket }))
vi.mock("@/lib/registration-capacity", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/registration-capacity")>()),
  claimRegistrationCapacity: mocks.claim,
}))

import { POST } from "@/app/api/registrations/route"
import { liveWorkspaceWhere } from "@/lib/public-events"

const EVENT = {
  id: "evt_1", title: "Open Day", slug: "open-day", status: "PUBLISHED", visibility: "PUBLIC", maxCapacity: 100,
  currentRegistrations: 0, waitlistEnabled: false, approvalRequired: false, isPaid: false,
  registrationStartDate: null, registrationEndDate: null, organizationId: "org_1", enterpriseId: null,
  termsAndConditions: null, settings: null,
}
const FREE_TICKET = { id: "tt_free", eventId: "evt_1", price: 0, maxPerUser: 5, currency: "INR", isActive: true }

const register = (body: Record<string, unknown>) =>
  POST(new NextRequest("http://localhost/api/registrations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventId: "evt_1", ticketTypeId: "tt_free", quantity: 1, ...body }),
  }))

const guest = { guestEmail: "  New.Guest@Example.com ", guestName: "New Guest" }

let ipCounter = 0

beforeEach(() => {
  vi.clearAllMocks()
  // A fresh client IP per test, so the per-IP guest limit only bites where a test means it to
  mocks.ip.value = `198.51.100.${++ipCounter}`
  mocks.auth.mockResolvedValue(null)
  mocks.prisma.user.findUnique.mockResolvedValue(null)
  mocks.prisma.user.upsert.mockResolvedValue({ id: "guest_user" })
  mocks.prisma.event.findUnique.mockResolvedValue(EVENT)
  mocks.prisma.ticketType.findFirst.mockResolvedValue(FREE_TICKET)
  mocks.prisma.registration.findUnique.mockResolvedValue(null)
  mocks.prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(mocks.tx))
  mocks.tx.registration.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "reg_1", ...data }))
  mocks.claim.mockResolvedValue({ waitlisted: false, waitlistPosition: null })
  mocks.issueFreeTicket.mockResolvedValue({ id: "ticket_1" })
})

describe("guest registration", () => {
  it("registers a guest for a free ticket on a public event", async () => {
    const res = await register(guest)
    expect(res.status).toBe(201)
    expect(mocks.prisma.user.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { email: "new.guest@example.com" },
      create: expect.objectContaining({ email: "new.guest@example.com", name: "New Guest" }),
    }))
    expect(mocks.tx.registration.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: "guest_user", status: "CONFIRMED" }) }))
  })

  it("puts the registration on an existing account with that email", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({ id: "existing_user" })
    expect((await register(guest)).status).toBe(201)
    expect(mocks.prisma.user.upsert).not.toHaveBeenCalled()
    expect(mocks.tx.registration.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: "existing_user" }) }))
  })

  it("refuses a paid ticket and creates no user", async () => {
    mocks.prisma.ticketType.findFirst.mockResolvedValue({ ...FREE_TICKET, price: 499 })
    const res = await register(guest)
    expect(res.status).toBe(401)
    expect((await res.json()).message).toMatch(/log in to buy a paid ticket/)
    expect(mocks.prisma.user.upsert).not.toHaveBeenCalled()
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled()
  })

  it.each(["PRIVATE", "INVITE_ONLY"])("refuses a %s event", async (visibility) => {
    mocks.prisma.event.findUnique.mockResolvedValue({ ...EVENT, visibility })
    expect((await register(guest)).status).toBe(401)
    expect(mocks.prisma.user.upsert).not.toHaveBeenCalled()
  })

  it.each([
    [{ guestName: "New Guest" }],
    [{ guestEmail: "new.guest@example.com" }],
    [{ guestEmail: "not-an-email", guestName: "New Guest" }],
    [{ guestEmail: "new.guest@example.com", guestName: " " }],
  ])("needs a name and a valid email: %j", async (body) => {
    expect((await register(body)).status).toBe(400)
    expect(mocks.prisma.user.upsert).not.toHaveBeenCalled()
  })

  it("applies the event's email domain restriction to the guest's email", async () => {
    mocks.prisma.event.findUnique.mockResolvedValue({ ...EVENT, settings: { allowedEmailDomains: "corp.example" } })
    expect((await register(guest)).status).toBe(403)
    expect((await register({ guestEmail: "a@corp.example", guestName: "A Person" })).status).toBe(201)
  })

  it("stops a duplicate registration for the same email", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({ id: "existing_user" })
    mocks.prisma.registration.findUnique.mockResolvedValue({ id: "reg_0", status: "CONFIRMED", registrationNumber: "EVT-1", payment: null })
    expect((await register(guest)).status).toBe(409)
  })

  it("limits how many guest registrations one IP can make", async () => {
    for (let i = 0; i < 10; i++) {
      expect((await register({ guestEmail: `g${i}@example.com`, guestName: "Guest Person" })).status).toBe(201)
    }
    expect((await register({ guestEmail: "g10@example.com", guestName: "Guest Person" })).status).toBe(429)
  })

  it("does not use a coupon for a guest", async () => {
    expect((await register({ ...guest, couponCode: "FREE100" })).status).toBe(201)
    expect(mocks.prisma.coupon.findFirst).not.toHaveBeenCalled()
  })

  it("answers 'Event not found' for a deleted event or one of a deactivated or deleted organization / enterprise", async () => {
    // the lookup itself carries the rule; a workspace that isn't live matches nothing
    mocks.prisma.event.findUnique.mockResolvedValue(null)
    const res = await register(guest)
    expect(res.status).toBe(404)
    expect((await res.json()).message).toBe("Event not found")
    expect(mocks.prisma.event.findUnique.mock.calls[0][0].where).toEqual({ id: "evt_1", deletedAt: null, ...liveWorkspaceWhere() })
    expect(mocks.prisma.user.upsert).not.toHaveBeenCalled()
  })
})
