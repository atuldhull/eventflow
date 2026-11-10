import { describe, it, expect, beforeEach, vi } from "vitest"

// "Add participant" (src/lib/manual-registration.ts): an organizer registers someone by
// email. Prisma, email, notifications, audit and the capacity helpers are stubbed; the
// tests check scoping, the refusals, and that the shared capacity/ticket steps are used.
const mocks = vi.hoisted(() => ({
  prisma: {
    event: { findFirst: vi.fn() },
    ticketType: { findFirst: vi.fn() },
    user: { findUnique: vi.fn() },
    registration: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
  tx: {
    user: { upsert: vi.fn() },
    registration: { create: vi.fn(), update: vi.fn() },
  },
  claim: vi.fn(),
  takeOver: vi.fn(),
  resetPayment: vi.fn(),
  issueFreeTicket: vi.fn(),
  sendEmail: vi.fn(),
  notify: vi.fn(),
  audit: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }))
vi.mock("@/lib/email", () => ({ sendEmail: mocks.sendEmail }))
vi.mock("@/lib/notifications", () => ({ createNotification: mocks.notify }))
vi.mock("@/lib/audit", () => ({ createAuditLog: mocks.audit }))
vi.mock("@/lib/seat-hold", () => ({ releaseExpiredHolds: vi.fn() }))
vi.mock("@/lib/registration-ticket", () => ({ issueFreeTicket: mocks.issueFreeTicket }))
vi.mock("@/lib/registration-capacity", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/registration-capacity")>()),
  claimRegistrationCapacity: mocks.claim,
  takeOverRegistration: mocks.takeOver,
  resetPaymentForReuse: mocks.resetPayment,
}))

import { CapacityError } from "@/lib/registration-capacity"
import { addParticipantManually, manualRegistrationSchema } from "@/lib/manual-registration"

const EVENT = { id: "evt_1", title: "Open Day", status: "REGISTRATION_OPEN", approvalRequired: false, settings: null, enterpriseId: null }
const FREE = { id: "tt_free", name: "General", price: 0 }

const input = (over: Record<string, unknown> = {}) =>
  manualRegistrationSchema.parse({ eventId: "evt_1", name: "New Person", email: " New.Person@Example.com ", ticketTypeId: "tt_free", ...over })

const add = (over: Partial<Parameters<typeof addParticipantManually>[0]> = {}) =>
  addParticipantManually({ orgId: "org_a", actorId: "admin_1", canApprove: true, input: input(), ...over })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.prisma.event.findFirst.mockResolvedValue(EVENT)
  mocks.prisma.ticketType.findFirst.mockResolvedValue(FREE)
  mocks.prisma.user.findUnique.mockResolvedValue(null)
  mocks.prisma.registration.findUnique.mockResolvedValue(null)
  mocks.prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(mocks.tx))
  mocks.tx.user.upsert.mockResolvedValue({ id: "new_user" })
  mocks.tx.registration.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "reg_1", ...data }))
  mocks.claim.mockResolvedValue({ waitlisted: false, waitlistPosition: null })
  mocks.issueFreeTicket.mockResolvedValue({ id: "ticket_1" })
  mocks.sendEmail.mockResolvedValue({ success: true })
})

describe("addParticipantManually", () => {
  it("looks the event up inside the organization, so another tenant's event is not found", async () => {
    mocks.prisma.event.findFirst.mockResolvedValue(null)
    const res = await add()
    expect(res).toEqual({ ok: false, status: 404, message: "Event not found" })
    expect(mocks.prisma.event.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "evt_1", organizationId: "org_a", deletedAt: null },
    }))
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled()
  })

  it("registers an unknown email: creates the account, claims capacity, issues the ticket, emails and audits", async () => {
    const res = await add()
    expect(res).toMatchObject({ ok: true, status: "CONFIRMED", userId: "new_user", complimentary: false })
    expect(mocks.tx.user.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { email: "new.person@example.com" },
      create: expect.objectContaining({ email: "new.person@example.com", name: "New Person", role: "USER" }),
    }))
    expect(mocks.claim).toHaveBeenCalledWith(mocks.tx, { eventId: "evt_1", ticketTypeId: "tt_free", quantity: 1, countsNow: true })
    expect(mocks.tx.registration.create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: "new_user", status: "CONFIRMED", source: "ORGANIZER" }) })
    expect(mocks.issueFreeTicket).toHaveBeenCalledWith(mocks.tx, expect.objectContaining({ registrationId: "reg_1", userId: "new_user" }))
    expect(mocks.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "new.person@example.com" }))
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ userId: "admin_1", action: "CREATE", entityType: "REGISTRATION", organizationId: "org_a", eventId: "evt_1" }))
  })

  it("uses an existing account with that email", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({ id: "existing_user" })
    expect(await add()).toMatchObject({ ok: true, userId: "existing_user" })
    expect(mocks.tx.user.upsert).not.toHaveBeenCalled()
  })

  it("refuses someone already registered, before touching capacity", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({ id: "existing_user" })
    mocks.prisma.registration.findUnique.mockResolvedValue({ id: "reg_0", status: "CONFIRMED", metadata: null, ticketTypeId: "tt_free", registrationNumber: "EVT-1", payment: null })
    const res = await add()
    expect(res).toMatchObject({ ok: false, status: 409 })
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled()
  })

  it("reuses a cancelled registration and closes its stale payment", async () => {
    const payment = { id: "pay_0", status: "FAILED", couponId: null, gatewayOrderId: null, amount: 0, currency: "INR", metadata: null }
    mocks.prisma.user.findUnique.mockResolvedValue({ id: "existing_user" })
    mocks.prisma.registration.findUnique.mockResolvedValue({ id: "reg_0", status: "CANCELLED", metadata: null, ticketTypeId: "tt_free", registrationNumber: "EVT-1", payment })
    mocks.tx.registration.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "reg_0", registrationNumber: "EVT-1", ...data }))
    expect(await add()).toMatchObject({ ok: true, registrationId: "reg_0", registrationNumber: "EVT-1" })
    expect(mocks.takeOver).toHaveBeenCalled()
    expect(mocks.resetPayment).toHaveBeenCalledWith(mocks.tx, payment, null)
  })

  it.each(["DRAFT", "CANCELLED", "COMPLETED"])("refuses a %s event", async (status) => {
    mocks.prisma.event.findFirst.mockResolvedValue({ ...EVENT, status })
    expect(await add()).toMatchObject({ ok: false, status: 400 })
  })

  it("refuses a ticket type that isn't this event's", async () => {
    mocks.prisma.ticketType.findFirst.mockResolvedValue(null)
    expect(await add()).toMatchObject({ ok: false, status: 400 })
    expect(mocks.prisma.ticketType.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "tt_free", eventId: "evt_1", isActive: true } }))
  })

  it("applies the event's email domain restriction", async () => {
    mocks.prisma.event.findFirst.mockResolvedValue({ ...EVENT, settings: { allowedEmailDomains: "corp.example" } })
    expect(await add()).toMatchObject({ ok: false, status: 403 })
  })

  it("passes on a full event as a capacity error, creating nothing", async () => {
    mocks.claim.mockRejectedValue(new CapacityError("EVENT_FULL"))
    expect(await add()).toEqual({ ok: false, status: 400, message: "Event is full" })
    expect(mocks.sendEmail).not.toHaveBeenCalled()
    expect(mocks.audit).not.toHaveBeenCalled()
  })

  it("issues a paid ticket type as complimentary, with no payment", async () => {
    mocks.prisma.ticketType.findFirst.mockResolvedValue({ id: "tt_vip", name: "VIP", price: 999 })
    const res = await add({ input: input({ ticketTypeId: "tt_vip" }) })
    expect(res).toMatchObject({ ok: true, status: "CONFIRMED", complimentary: true })
    expect(mocks.tx.registration.create).toHaveBeenCalledWith({ data: expect.objectContaining({ metadata: expect.objectContaining({ complimentary: true }) }) })
    expect(mocks.issueFreeTicket).toHaveBeenCalled()
  })

  it("leaves an approval-required add pending when the organizer can't approve", async () => {
    mocks.prisma.event.findFirst.mockResolvedValue({ ...EVENT, approvalRequired: true })
    const res = await add({ canApprove: false })
    expect(res).toMatchObject({ ok: true, status: "PENDING" })
    expect(mocks.claim).toHaveBeenCalledWith(mocks.tx, expect.objectContaining({ countsNow: false }))
    expect(mocks.issueFreeTicket).not.toHaveBeenCalled()
  })

  it("waitlists when the event is full and has a waitlist", async () => {
    mocks.claim.mockResolvedValue({ waitlisted: true, waitlistPosition: 3 })
    expect(await add()).toMatchObject({ ok: true, status: "WAITLISTED" })
    expect(mocks.issueFreeTicket).not.toHaveBeenCalled()
  })
})

describe("manualRegistrationSchema", () => {
  it.each([
    [{ name: "A" }],
    [{ email: "not-an-email" }],
    [{ ticketTypeId: "" }],
  ])("rejects %j", (over) => {
    expect(manualRegistrationSchema.safeParse({ eventId: "evt_1", name: "New Person", email: "a@b.co", ticketTypeId: "tt", ...over }).success).toBe(false)
  })
})
