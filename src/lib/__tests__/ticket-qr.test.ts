import { describe, it, expect, beforeEach, vi } from "vitest"

// One issuer for every ticket path, and a validator that accepts its signed payload (and,
// inside the scanned event only, the legacy unsigned "EVF-..." codes).
const prismaMock = vi.hoisted(() => ({
  ticket: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
  registration: { findUnique: vi.fn() },
  notification: { create: vi.fn() },
  $transaction: vi.fn(),
}))
vi.mock("@/lib/prisma", () => ({ default: prismaMock, prisma: prismaMock }))

import { issueTicket, createQRPayload, verifyQRSignature, LEGACY_QR_PATTERN } from "@/lib/registration-ticket"
import { generateTicket, getUserTickets, validateTicketQR } from "@/lib/ticket"
import { ticketViewTokenMatches, newTicketViewToken, withTicketViewToken } from "@/lib/ticket-view-token"

const EVENT = "event_1"
const REG = { registrationId: "reg_1", ticketTypeId: "tt_1", userId: "user_1", eventId: EVENT }
const inAnHour = () => new Date(Date.now() + 60 * 60 * 1000)

function makeTx() {
  return {
    ticket: {
      findUnique: vi.fn(),
      create: vi.fn(async ({ data }) => ({ id: "tkt_new", ...data })),
      update: vi.fn(async ({ data }) => ({ id: "tkt_old", ...data })),
    },
    registration: { findUnique: vi.fn().mockResolvedValue({ registrationNumber: "EVT-2026-00001", event: { title: "Demo Day" } }) },
    notification: { create: vi.fn() },
  }
}

function ticketRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "tkt_1",
    ticketNumber: "TKT-ABCD2345",
    eventId: EVENT,
    status: "ACTIVE",
    validUntil: null,
    registration: { id: "reg_1", registrationNumber: "EVT-2026-00001", status: "CONFIRMED" },
    event: { id: EVENT, title: "Demo Day", startDate: new Date(), endDate: inAnHour(), venue: "Hall A", isOnline: false },
    user: { name: "Asha", email: "asha@example.com", avatar: null },
    ticketType: { name: "General", price: 0 },
    ...overrides,
  }
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv("TICKET_SECRET", "s".repeat(48))
})

describe("issueTicket (free, manual add, approval, paid completion)", () => {
  it("creates a ticket whose QR is the signed payload the validator accepts", async () => {
    const tx = makeTx()
    tx.ticket.findUnique.mockResolvedValue(null)

    const ticket = await issueTicket(tx as never, REG)

    const data = tx.ticket.create.mock.calls[0][0].data
    expect(data.ticketNumber).toMatch(/^TKT-[A-Z2-9]{8}$/)
    const payload = JSON.parse(data.qrCode)
    expect(payload).toMatchObject({ v: 1, t: data.ticketNumber, e: EVENT, r: "EVT-2026-00001" })
    expect(verifyQRSignature(payload.t, payload.e, payload.r, payload.s)).toBe(true)
    expect(LEGACY_QR_PATTERN.test(data.qrCode)).toBe(false)
    expect(ticket.status).toBe("ACTIVE")
  })

  it("tells the attendee once, in the same transaction", async () => {
    const tx = makeTx()
    tx.ticket.findUnique.mockResolvedValue(null)
    await issueTicket(tx as never, REG)
    expect(tx.notification.create).toHaveBeenCalledTimes(1)
    expect(tx.notification.create.mock.calls[0][0].data).toMatchObject({ userId: "user_1", category: "REGISTRATION", eventId: EVENT })
  })

  it("returns a live ticket as it is (no new number, no second notification)", async () => {
    const tx = makeTx()
    const live = { id: "tkt_old", status: "ACTIVE", qrCode: "EVF-1234abcd-123" }
    tx.ticket.findUnique.mockResolvedValue(live)

    expect(await issueTicket(tx as never, REG)).toBe(live)
    expect(tx.ticket.create).not.toHaveBeenCalled()
    expect(tx.ticket.update).not.toHaveBeenCalled()
    expect(tx.notification.create).not.toHaveBeenCalled()
  })

  it("re-activates a cancelled ticket with a fresh signed QR and revokes its guest link", async () => {
    const tx = makeTx()
    const { hash } = newTicketViewToken()
    // first lookup: the registration's ticket; then the new number is free
    tx.ticket.findUnique
      .mockResolvedValueOnce({ id: "tkt_old", status: "CANCELLED", qrCode: "EVF-1234abcd-123", ticketNumber: "TKT-OLD", metadata: withTicketViewToken({ keep: 1 }, hash) })
      .mockResolvedValue(null)

    await issueTicket(tx as never, REG)

    const data = tx.ticket.update.mock.calls[0][0].data
    expect(data.status).toBe("ACTIVE")
    expect(data.ticketNumber).not.toBe("TKT-OLD")
    expect(JSON.parse(data.qrCode).t).toBe(data.ticketNumber)
    expect(data.metadata).toEqual({ keep: 1 })
  })

  it("is what paid completion (generateTicket) uses too", async () => {
    const tx = makeTx()
    tx.ticket.findUnique.mockResolvedValue(null)
    prismaMock.registration.findUnique.mockResolvedValue({ id: "reg_1", eventId: EVENT, ticketTypeId: "tt_1", userId: "user_1" })
    prismaMock.$transaction.mockImplementation(async (fn: (t: unknown) => unknown) => fn(tx))

    await generateTicket("reg_1")

    const qr = JSON.parse(tx.ticket.create.mock.calls[0][0].data.qrCode)
    expect(verifyQRSignature(qr.t, qr.e, qr.r, qr.s)).toBe(true)
  })
})

describe("validateTicketQR", () => {
  const signed = () => createQRPayload("TKT-ABCD2345", EVENT, "EVT-2026-00001")

  it("accepts the signed payload for the scanned event", async () => {
    prismaMock.ticket.findUnique.mockResolvedValue(ticketRow())
    const result = await validateTicketQR(signed(), { eventId: EVENT })
    expect(result.valid).toBe(true)
    if (result.valid) expect(result.ticket).toMatchObject({ id: "tkt_1", registrationId: "reg_1" })
  })

  it("rejects a tampered signature", async () => {
    const payload = JSON.parse(signed())
    payload.s = "0".repeat(64)
    const result = await validateTicketQR(JSON.stringify(payload), { eventId: EVENT })
    expect(result).toMatchObject({ valid: false, reason: "INVALID_SIGNATURE" })
    expect(prismaMock.ticket.findUnique).not.toHaveBeenCalled()
  })

  it("rejects a ticket of another event before looking it up", async () => {
    const result = await validateTicketQR(signed(), { eventId: "event_other" })
    expect(result).toMatchObject({ valid: false, reason: "WRONG_EVENT" })
    expect(prismaMock.ticket.findUnique).not.toHaveBeenCalled()
  })

  it("rejects a signed payload whose registration doesn't match the ticket", async () => {
    prismaMock.ticket.findUnique.mockResolvedValue(ticketRow({ registration: { id: "reg_1", registrationNumber: "EVT-2026-99999", status: "CONFIRMED" } }))
    expect(await validateTicketQR(signed(), { eventId: EVENT })).toMatchObject({ valid: false, reason: "INVALID_SIGNATURE" })
  })

  it("expires a ticket two hours after the event's current end", async () => {
    prismaMock.ticket.findUnique.mockResolvedValue(ticketRow({ event: { ...ticketRow().event, endDate: new Date(Date.now() - 3 * 60 * 60 * 1000) } }))
    expect(await validateTicketQR(signed(), { eventId: EVENT })).toMatchObject({ valid: false, reason: "EXPIRED" })
  })

  it("accepts a legacy EVF code only by an exact lookup inside the scanned event", async () => {
    prismaMock.ticket.findFirst.mockResolvedValue(ticketRow({ qrCode: "EVF-1234abcd-5ef" }))
    const result = await validateTicketQR("  EVF-1234abcd-5ef ", { eventId: EVENT })
    expect(result.valid).toBe(true)
    expect(prismaMock.ticket.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { qrCode: "EVF-1234abcd-5ef", eventId: EVENT } }))
  })

  it("does not find a legacy code of another event, or without an event", async () => {
    prismaMock.ticket.findFirst.mockResolvedValue(null)
    expect(await validateTicketQR("EVF-1234abcd-5ef", { eventId: "event_other" })).toMatchObject({ valid: false, reason: "NOT_FOUND" })
    expect(await validateTicketQR("EVF-1234abcd-5ef")).toMatchObject({ valid: false, reason: "NOT_FOUND" })
    expect(prismaMock.ticket.findFirst).toHaveBeenCalledTimes(1)
  })

  it("still refuses a used legacy ticket and anything that isn't a ticket", async () => {
    prismaMock.ticket.findFirst.mockResolvedValue(ticketRow({ status: "USED" }))
    expect(await validateTicketQR("EVF-1234abcd-5ef", { eventId: EVENT })).toMatchObject({ valid: false, reason: "ALREADY_USED" })
    expect(await validateTicketQR("EVF-not-a-code", { eventId: EVENT })).toMatchObject({ valid: false, reason: "INVALID_FORMAT" })
    expect(await validateTicketQR("null", { eventId: EVENT })).toMatchObject({ valid: false, reason: "INVALID_FORMAT" })
  })
})

describe("getUserTickets timeframes", () => {
  it("keeps a running event under upcoming (not ended) and splits past by end date", async () => {
    prismaMock.ticket.findMany.mockResolvedValue([])
    await getUserTickets("user_1", undefined, "upcoming")
    await getUserTickets("user_1", undefined, "past")
    const [upcoming, past] = prismaMock.ticket.findMany.mock.calls.map((c) => c[0].where)
    expect(upcoming.event.endDate.gte).toBeInstanceOf(Date)
    expect(upcoming.event.startDate).toBeUndefined()
    expect(past.event.endDate.lt).toBeInstanceOf(Date)
  })
})

describe("guest ticket view token", () => {
  it("matches only the token whose hash is stored", () => {
    const { token, hash } = newTicketViewToken()
    const meta = withTicketViewToken(null, hash)
    expect(ticketViewTokenMatches(meta, token)).toBe(true)
    expect(ticketViewTokenMatches(meta, newTicketViewToken().token)).toBe(false)
    expect(ticketViewTokenMatches({}, token)).toBe(false)
    expect(ticketViewTokenMatches(meta, null)).toBe(false)
    expect(JSON.stringify(meta)).not.toContain(token)
  })
})
