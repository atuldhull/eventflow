import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"
import bcrypt from "bcryptjs"

// DPDP rights: "Download my data" never copies secrets out, and "Delete my account" needs
// the password (or DELETE for social sign-in), refuses a sole owner, and anonymises the
// person while keeping payments and freeing the seats of upcoming registrations.
const mocks = vi.hoisted(() => {
  const model = () => ({
    findMany: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn(), update: vi.fn(), count: vi.fn(),
  })
  const tx = {
    registration: model(), ticket: model(), certificate: model(), feedback: model(), contactMessage: model(),
    auditLog: model(), organizationMember: model(), enterpriseMember: model(), eventTeamMember: model(),
    savedEvent: model(), notification: model(), waitlistEntry: model(), session: model(), account: model(),
    refreshToken: model(), oTP: model(), verificationToken: model(), user: model(), payment: model(),
  }
  const prisma = {
    user: model(), registration: model(), ticket: model(), payment: model(), certificate: model(),
    notification: model(), savedEvent: model(), organizationMember: model(), enterpriseMember: model(),
    enterprise: model(), eventTeamMember: model(), feedback: model(), contactMessage: model(), auditLog: model(),
    $transaction: vi.fn(),
  }
  return {
    tx, prisma,
    auth: vi.fn(),
    createAuditLog: vi.fn(),
    releaseEventSeat: vi.fn(),
    releaseStockAndCoupon: vi.fn(),
    releaseSeatHoldInTx: vi.fn(),
  }
})

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }))
vi.mock("@/lib/auth", () => ({ auth: mocks.auth }))
vi.mock("@/lib/audit", () => ({ createAuditLog: mocks.createAuditLog, getClientInfo: () => ({}) }))
vi.mock("@/lib/registration-capacity", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/registration-capacity")>()),
  releaseEventSeat: mocks.releaseEventSeat,
  releaseStockAndCoupon: mocks.releaseStockAndCoupon,
}))
vi.mock("@/lib/seat-hold", () => ({ releaseSeatHoldInTx: mocks.releaseSeatHoldInTx }))

import { GET as exportRoute } from "@/app/api/users/me/export/route"
import { DELETE as deleteRoute } from "@/app/api/users/me/route"
import { rateLimiter } from "@/lib/rate-limiter"

const USER_ID = "user_1"
const PASSWORD = "correct horse battery"
let PASSWORD_HASH = ""

const callDelete = (body: unknown) =>
  deleteRoute(new NextRequest("http://localhost/api/users/me", {
    method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  }))

function resetModels(group: Record<string, Record<string, ReturnType<typeof vi.fn>> | ReturnType<typeof vi.fn>>) {
  for (const value of Object.values(group)) {
    if (typeof value === "function") continue
    value.findMany.mockResolvedValue([])
    value.findUnique.mockResolvedValue(null)
    value.updateMany.mockResolvedValue({ count: 1 })
    value.deleteMany.mockResolvedValue({ count: 0 })
    value.update.mockResolvedValue({})
    value.count.mockResolvedValue(0)
  }
}

beforeEach(async () => {
  vi.resetAllMocks()
  PASSWORD_HASH ||= await bcrypt.hash(PASSWORD, 4)
  await rateLimiter.reset(`data-export:${USER_ID}`)
  await rateLimiter.reset(`account-delete:${USER_ID}`)
  resetModels(mocks.prisma as never)
  resetModels(mocks.tx as never)
  mocks.prisma.$transaction.mockImplementation((fn: (tx: typeof mocks.tx) => unknown) => fn(mocks.tx))
  mocks.auth.mockResolvedValue({ user: { id: USER_ID } })
  mocks.releaseStockAndCoupon.mockResolvedValue({ stockReleasedAt: "now" })
  mocks.prisma.user.findUnique.mockResolvedValue({
    id: USER_ID, email: "asha@example.com", passwordHash: PASSWORD_HASH, deletedAt: null, role: "USER",
  })
})

describe("GET /api/users/me/export", () => {
  it("needs a signed-in user", async () => {
    mocks.auth.mockResolvedValue(null)
    expect((await exportRoute()).status).toBe(401)
  })

  it("downloads the account's data as a JSON attachment without any secret", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({
      id: USER_ID, email: "asha@example.com", name: "Asha", phone: "+919800000000",
      passwordHash: "$2b$12$SECRET_HASH", twoFactorSecret: "TOTP_SECRET",
      metadata: { notificationPreferences: { marketing: { email: false, inApp: false } }, passwordChangedAt: "2026-01-01" },
      accounts: [{ provider: "google", createdAt: new Date(), access_token: "OAUTH_TOKEN" }],
      interests: [],
    })
    mocks.prisma.ticket.findMany.mockResolvedValue([
      { ticketNumber: "TKT-1", status: "ACTIVE", qrCode: "SIGNED_QR_PAYLOAD", barcode: "BARCODE_SECRET", metadata: { viewToken: "VIEW_TOKEN" }, event: { title: "Demo Day" }, ticketType: { name: "General" }, registration: { registrationNumber: "REG-1" } },
    ])
    mocks.prisma.payment.findMany.mockResolvedValue([
      { paymentNumber: "PAY-1", invoiceNumber: "INV-1", amount: 499, status: "COMPLETED", gatewaySignature: "GATEWAY_SIGNATURE", gatewayResponse: { secret: "RAW_GATEWAY" }, event: { title: "Demo Day" }, registration: { registrationNumber: "REG-1" } },
    ])
    mocks.prisma.registration.findMany.mockResolvedValue([
      { registrationNumber: "REG-1", status: "CONFIRMED", formResponses: { college: "IIT" }, metadata: { holdExpiresAt: "x" }, event: { title: "Demo Day" }, ticketType: { name: "General" } },
    ])

    const res = await exportRoute()
    expect(res.status).toBe(200)
    expect(res.headers.get("Content-Disposition")).toMatch(/^attachment; filename="eventflow-data-\d{4}-\d{2}-\d{2}\.json"$/)
    const text = await res.text()
    for (const secret of ["SECRET_HASH", "TOTP_SECRET", "OAUTH_TOKEN", "SIGNED_QR_PAYLOAD", "BARCODE_SECRET", "VIEW_TOKEN", "GATEWAY_SIGNATURE", "RAW_GATEWAY", "passwordChangedAt", "holdExpiresAt"]) {
      expect(text).not.toContain(secret)
    }
    const data = JSON.parse(text)
    expect(data.profile).toMatchObject({ email: "asha@example.com", name: "Asha", signInMethods: ["password", "google"] })
    expect(data.tickets[0]).toMatchObject({ ticketNumber: "TKT-1", status: "ACTIVE", registrationNumber: "REG-1" })
    expect(data.payments[0]).toMatchObject({ paymentNumber: "PAY-1", invoiceNumber: "INV-1", amount: 499, status: "COMPLETED" })
    expect(data.registrations[0]).toMatchObject({ registrationNumber: "REG-1", formResponses: { college: "IIT" } })
    // the database query never asks for the secrets either
    const userSelect = mocks.prisma.user.findUnique.mock.calls[0][0].select
    expect(userSelect.twoFactorSecret).toBeUndefined()
    expect(mocks.prisma.ticket.findMany.mock.calls[0][0].select.qrCode).toBeUndefined()
  })

  it("is rate limited to a few downloads an hour", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({ id: USER_ID, email: "a@b.c", metadata: null, accounts: [], interests: [] })
    for (let i = 0; i < 3; i++) expect((await exportRoute()).status).toBe(200)
    expect((await exportRoute()).status).toBe(429)
  })
})

describe("DELETE /api/users/me", () => {
  it("needs a signed-in user", async () => {
    mocks.auth.mockResolvedValue(null)
    expect((await callDelete({ password: PASSWORD })).status).toBe(401)
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled()
  })

  it("refuses a wrong password and changes nothing", async () => {
    const res = await callDelete({ password: "wrong password" })
    expect(res.status).toBe(400)
    expect((await res.json()).message).toBe("Password is incorrect")
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled()
    expect(mocks.createAuditLog).not.toHaveBeenCalled()
  })

  it("social-only accounts confirm by typing DELETE, not with a password", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({ id: USER_ID, email: "asha@example.com", passwordHash: null, deletedAt: null, role: "USER" })
    expect((await callDelete({ confirmation: "delete please" })).status).toBe(400)
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled()
    expect((await callDelete({ confirmation: "DELETE" })).status).toBe(200)
  })

  it("refuses the only admin of an organization that still has members or events", async () => {
    mocks.prisma.organizationMember.findMany.mockResolvedValue([
      { organization: { id: "org_1", name: "Robotics Club", members: [{ role: "COORDINATOR" }], _count: { events: 0 } } },
    ])
    const res = await callDelete({ password: PASSWORD })
    expect(res.status).toBe(409)
    expect((await res.json()).message).toContain("Robotics Club")
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled()
  })

  it("refuses the owner of an enterprise with active events", async () => {
    mocks.prisma.enterprise.findMany.mockResolvedValue([{ id: "ent_1", name: "Acme University", _count: { members: 0, events: 2 } }])
    const res = await callDelete({ password: PASSWORD })
    expect(res.status).toBe(409)
    expect((await res.json()).message).toContain("Acme University")
  })

  it("does not block when another admin remains", async () => {
    mocks.prisma.organizationMember.findMany.mockResolvedValue([
      { organization: { id: "org_1", name: "Robotics Club", members: [{ role: "ORG_ADMIN" }], _count: { events: 3 } } },
    ])
    expect((await callDelete({ password: PASSWORD })).status).toBe(200)
  })

  it("anonymises the person, cancels upcoming registrations, keeps payments and ends sign-in", async () => {
    mocks.tx.registration.findMany.mockResolvedValue([
      { id: "reg_1", status: "CONFIRMED", eventId: "evt_1", metadata: {}, payment: { couponId: "cpn_1" } },
    ])
    mocks.tx.registration.findUnique.mockResolvedValue({ status: "CONFIRMED", metadata: {}, ticketTypeId: "tt_1" })

    const res = await callDelete({ password: PASSWORD })
    expect(res.status).toBe(200)
    expect((await res.json()).data).toEqual({ cancelledRegistrations: 1 })

    // only registrations for events that haven't ended
    const openWhere = mocks.tx.registration.findMany.mock.calls[0][0].where
    expect(openWhere).toMatchObject({ userId: USER_ID, status: { in: ["PENDING", "CONFIRMED", "WAITLISTED"] }, event: { endDate: { gte: expect.any(Date) } } })
    // cancelled with its ticket voided, seat, stock and coupon given back
    expect(mocks.tx.registration.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "reg_1", status: "CONFIRMED" },
      data: expect.objectContaining({ status: "CANCELLED" }),
    }))
    expect(mocks.tx.ticket.updateMany).toHaveBeenCalledWith({ where: { registrationId: "reg_1", status: "ACTIVE" }, data: { status: "CANCELLED" } })
    expect(mocks.releaseEventSeat).toHaveBeenCalledWith(mocks.tx, "evt_1")
    expect(mocks.releaseStockAndCoupon).toHaveBeenCalledWith(mocks.tx, expect.objectContaining({ ticketTypeId: "tt_1" }), "cpn_1")

    // payments are never touched
    expect(mocks.tx.payment.updateMany).not.toHaveBeenCalled()
    expect(mocks.tx.payment.deleteMany).not.toHaveBeenCalled()

    // memberships, saved events, notifications and every sign-in method removed
    for (const m of ["organizationMember", "enterpriseMember", "savedEvent", "notification", "session", "account", "refreshToken", "verificationToken"] as const) {
      expect(mocks.tx[m].deleteMany).toHaveBeenCalled()
    }

    // the row is anonymised in place, once, and can't sign in again
    const userUpdate = mocks.tx.user.updateMany.mock.calls[0][0]
    expect(userUpdate.where).toEqual({ id: USER_ID, deletedAt: null })
    expect(userUpdate.data).toMatchObject({
      name: "Deleted user", email: `deleted-${USER_ID}@deleted.invalid`, phone: null, avatar: null,
      passwordHash: null, twoFactorSecret: null, isActive: false, deletedAt: expect.any(Date), role: "USER",
    })

    // audit entry without personal data
    expect(mocks.createAuditLog).toHaveBeenCalledTimes(1)
    const audit = mocks.createAuditLog.mock.calls[0][0]
    expect(audit).toMatchObject({ userId: USER_ID, action: "DELETE", entityType: "USER", entityId: USER_ID })
    expect(JSON.stringify(audit)).not.toContain("asha@example.com")
    expect(audit.ipAddress).toBeUndefined()
  })

  it("a registration still holding its seat during checkout releases the hold", async () => {
    const holdMeta = { holdExpiresAt: new Date(Date.now() + 60_000).toISOString() }
    mocks.tx.registration.findMany.mockResolvedValue([
      { id: "reg_2", status: "PENDING", eventId: "evt_2", metadata: holdMeta, payment: { couponId: null } },
    ])
    mocks.releaseSeatHoldInTx.mockResolvedValue(true)
    const res = await callDelete({ password: PASSWORD })
    expect(res.status).toBe(200)
    expect(mocks.releaseSeatHoldInTx).toHaveBeenCalledWith(mocks.tx, "reg_2", "cancelled")
    expect(mocks.releaseEventSeat).not.toHaveBeenCalled()
  })
})
