import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

const prismaMock = vi.hoisted(() => ({
  ticket: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  registration: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  checkIn: { findFirst: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
  event: { findUnique: vi.fn() },
  $transaction: vi.fn(),
}))
const authMock = vi.hoisted(() => vi.fn())
const authorizeMock = vi.hoisted(() => vi.fn())
const auditMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/prisma", () => ({ default: prismaMock, prisma: prismaMock }))
vi.mock("@/lib/auth", () => ({ auth: authMock }))
vi.mock("@/lib/authorization", () => ({ authorize: authorizeMock }))
vi.mock("@/lib/audit", () => ({ createAuditLog: auditMock, getClientInfo: () => ({ ipAddress: "127.0.0.1", userAgent: "vitest" }) }))

import * as checkInRoute from "@/app/api/check-in/route"
import * as searchRoute from "@/app/api/check-in/search/route"
import * as undoRoute from "@/app/api/check-in/undo/route"
import { getRolePermissions, PERMISSIONS } from "@/lib/permissions"

const EVENT = "event_1"
const STAFF = "user_staff"

const post = (url: string, body: unknown) =>
  new NextRequest(`http://localhost${url}`, { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } })

const legacyTicket = {
  id: "tkt_1",
  ticketNumber: "TKT-1A2B3C4D",
  eventId: EVENT,
  status: "ACTIVE",
  registration: { id: "reg_1", registrationNumber: "EVT-2026-00001", status: "CONFIRMED" },
  event: { id: EVENT, title: "Demo Day", startDate: new Date(), endDate: new Date(Date.now() + 3600_000), venue: null, isOnline: false },
  user: { name: "Asha", email: "asha@example.com", avatar: null },
  ticketType: { name: "General", price: 0 },
}

beforeEach(() => {
  vi.resetAllMocks()
  authMock.mockResolvedValue({ user: { id: STAFF, role: "USER", name: "Door" } })
  authorizeMock.mockResolvedValue({ authorized: true, role: "COORDINATOR" })
  prismaMock.event.findUnique.mockResolvedValue({ organizationId: "org_1", enterpriseId: null, organization: { enterpriseId: "ent_1" } })
})

describe("POST /api/check-in", () => {
  function allowCheckIn() {
    prismaMock.checkIn.findFirst.mockResolvedValue(null)
    prismaMock.registration.findUnique.mockResolvedValue({ userId: "user_asha" })
    const tx = {
      checkIn: { create: vi.fn().mockResolvedValue({ id: "ci_1" }) },
      registration: { update: vi.fn() },
      ticket: { update: vi.fn() },
    }
    prismaMock.$transaction.mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx))
    return tx
  }

  it("checks in a free ticket that still carries a legacy EVF code, within the scanned event", async () => {
    prismaMock.ticket.findFirst.mockResolvedValue(legacyTicket)
    const tx = allowCheckIn()

    const res = await checkInRoute.POST(post("/api/check-in", { method: "QR_SCAN", eventId: EVENT, qrData: "EVF-1a2b3c4d-5e6" }))

    expect(res.status).toBe(200)
    expect(prismaMock.ticket.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { qrCode: "EVF-1a2b3c4d-5e6", eventId: EVENT } }))
    expect(tx.checkIn.create.mock.calls[0][0].data).toMatchObject({ registrationId: "reg_1", ticketId: "tkt_1", checkedInBy: STAFF })
  })

  it("writes an audit row with the organization, event and the staff member", async () => {
    prismaMock.ticket.findFirst.mockResolvedValue(legacyTicket)
    allowCheckIn()

    await checkInRoute.POST(post("/api/check-in", { method: "QR_SCAN", eventId: EVENT, qrData: "EVF-1a2b3c4d-5e6" }))

    expect(auditMock).toHaveBeenCalledTimes(1)
    expect(auditMock.mock.calls[0][0]).toMatchObject({
      userId: STAFF,
      action: "CHECK_IN",
      entityType: "CHECK_IN",
      entityId: "ci_1",
      eventId: EVENT,
      organizationId: "org_1",
      enterpriseId: "ent_1",
    })
  })

  it("audits a manual check-in too", async () => {
    prismaMock.registration.findUnique
      .mockResolvedValueOnce({
        id: "reg_1", eventId: EVENT, status: "CONFIRMED",
        user: { name: "Asha", email: "asha@example.com", avatar: null },
        ticket: { id: "tkt_1", ticketNumber: "TKT-1A2B3C4D" },
        ticketType: { name: "General" },
      })
    allowCheckIn()
    prismaMock.registration.findUnique.mockResolvedValueOnce({ userId: "user_asha" })

    const res = await checkInRoute.POST(post("/api/check-in", { method: "MANUAL", eventId: EVENT, registrationId: "reg_1" }))

    expect(res.status).toBe(200)
    expect(auditMock.mock.calls[0][0]).toMatchObject({ action: "CHECK_IN", organizationId: "org_1", eventId: EVENT })
  })

  it("does not audit a refused scan", async () => {
    prismaMock.ticket.findFirst.mockResolvedValue(null)
    const res = await checkInRoute.POST(post("/api/check-in", { method: "QR_SCAN", eventId: EVENT, qrData: "EVF-1a2b3c4d-5e6" }))
    expect(res.status).toBe(400)
    expect(auditMock).not.toHaveBeenCalled()
  })
})

describe("GET /api/check-in/search", () => {
  it("finds the ticket number printed under the QR, trimmed and case-insensitive, within the event", async () => {
    prismaMock.registration.findMany.mockResolvedValue([{
      id: "reg_1", registrationNumber: "EVT-2026-00001", status: "CONFIRMED",
      user: { name: "Asha", email: "asha@example.com", avatar: null },
      ticketType: { name: "General" }, ticket: { ticketNumber: "TKT-1A2B3C4D" }, checkIn: null,
    }])

    const res = await searchRoute.GET(new NextRequest(`http://localhost/api/check-in/search?eventId=${EVENT}&search=%20tkt-1a2b3c4d%20`))
    const json = await res.json()

    const where = prismaMock.registration.findMany.mock.calls[0][0].where
    expect(where.eventId).toBe(EVENT)
    expect(where.OR).toEqual(expect.arrayContaining([
      { ticket: { is: { ticketNumber: { contains: "tkt-1a2b3c4d", mode: "insensitive" } } } },
      { registrationNumber: { contains: "tkt-1a2b3c4d", mode: "insensitive" } },
    ]))
    expect(json.data[0]).toMatchObject({ registrationId: "reg_1", ticketNumber: "TKT-1A2B3C4D" })
  })

  it("needs check-in access to the event", async () => {
    authorizeMock.mockResolvedValue({ authorized: false, message: "nope" })
    const res = await searchRoute.GET(new NextRequest(`http://localhost/api/check-in/search?eventId=${EVENT}&search=asha`))
    expect(res.status).toBe(403)
    expect(prismaMock.registration.findMany).not.toHaveBeenCalled()
  })
})

describe("POST /api/check-in/undo", () => {
  it("audits the undo with the organization, event and actor", async () => {
    prismaMock.checkIn.findUnique.mockResolvedValue({
      registrationId: "reg_1", ticketId: "tkt_1", eventId: EVENT, userId: "user_asha", checkInMethod: "QR_SCAN",
      checkedInAt: new Date("2026-11-09T10:00:00Z"), user: { name: "Asha" },
      event: { organizationId: "org_1", enterpriseId: null, organization: { enterpriseId: null } },
    })

    const res = await undoRoute.POST(post("/api/check-in/undo", { checkInId: "ci_1" }))

    expect(res.status).toBe(200)
    expect(auditMock.mock.calls[0][0]).toMatchObject({
      userId: STAFF, action: "DELETE", entityType: "CHECK_IN", entityId: "ci_1", eventId: EVENT, organizationId: "org_1",
    })
  })

  it("rejects a malformed body", async () => {
    const res = await undoRoute.POST(post("/api/check-in/undo", { checkInId: 42 }))
    expect(res.status).toBe(400)
    expect(prismaMock.checkIn.findUnique).not.toHaveBeenCalled()
  })
})

describe("who can run the door", () => {
  it("lets event managers and coordinators check people in, not viewers", () => {
    expect(getRolePermissions("EVENT_MANAGER")).toContain(PERMISSIONS.CHECKIN_PERFORM)
    expect(getRolePermissions("COORDINATOR")).toContain(PERMISSIONS.CHECKIN_PERFORM)
    expect(getRolePermissions("VIEWER")).not.toContain(PERMISSIONS.CHECKIN_PERFORM)
  })

  it("keeps the attendance export away from coordinators (volunteers)", () => {
    const coordinator = getRolePermissions("COORDINATOR")
    expect(coordinator).not.toContain(PERMISSIONS.REGISTRATION_EXPORT)
    expect(coordinator).not.toContain(PERMISSIONS.CHECKIN_MANAGE)
  })
})
