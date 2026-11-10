import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

// Approving a pending registration (PATCH .../registrations/[id]/status): a guest (no
// password, no social sign-in) gets the view-only ticket link by email, as the free guest
// flow does; an account holder doesn't. Prisma, auth and side effects are mocked.
const mocks = vi.hoisted(() => {
  const tx = {
    registration: { findUnique: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
    ticket: { updateMany: vi.fn() },
  }
  return {
    tx,
    prisma: {
      registration: { findFirst: vi.fn() },
      user: { findUnique: vi.fn() },
      ticket: { findUnique: vi.fn(), update: vi.fn() },
      notification: { create: vi.fn() },
      $transaction: vi.fn(),
    },
    auth: vi.fn(),
    authorize: vi.fn(),
    sendEmail: vi.fn(),
    issueFreeTicket: vi.fn(),
  }
})

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }))
vi.mock("@/lib/auth", () => ({ auth: mocks.auth }))
vi.mock("@/lib/authorization", () => ({ authorize: mocks.authorize }))
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn(), getClientInfo: () => ({ ipAddress: "127.0.0.1", userAgent: "vitest" }) }))
vi.mock("@/lib/email", () => ({ sendEmail: mocks.sendEmail }))
vi.mock("@/lib/seat-hold", () => ({ releaseSeatHoldInTx: vi.fn() }))
vi.mock("@/lib/payment-completion", () => ({ ensureTicketForRegistration: vi.fn() }))
vi.mock("@/lib/registration-ticket", () => ({ issueFreeTicket: mocks.issueFreeTicket }))
vi.mock("@/lib/registration-capacity", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/registration-capacity")>()),
  claimEventSeat: vi.fn(async () => true),
  claimTicketStock: vi.fn(async () => true),
}))

import { PATCH } from "@/app/api/admin/org/[orgId]/registrations/[registrationId]/status/route"
import { ticketViewTokenMatches } from "@/lib/ticket-view-token"

const ORG = "org_a"
const approve = () =>
  PATCH(
    new NextRequest(`http://localhost/api/admin/org/${ORG}/registrations/reg_1/status`, {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "CONFIRMED" }),
    }),
    { params: Promise.resolve({ orgId: ORG, registrationId: "reg_1" }) }
  )

beforeEach(() => {
  vi.resetAllMocks()
  mocks.auth.mockResolvedValue({ user: { id: "admin_1" } })
  mocks.authorize.mockResolvedValue({ authorized: true })
  mocks.prisma.$transaction.mockImplementation(async (fn: (tx: typeof mocks.tx) => unknown) => fn(mocks.tx))
  mocks.prisma.registration.findFirst.mockResolvedValue({
    id: "reg_1", status: "PENDING", userId: "user_g", eventId: "ev_1", registrationNumber: "EVT-2026-00001",
    event: { title: "Open <Day>", slug: "open-day", currentRegistrations: 3 },
  })
  mocks.tx.registration.findUnique.mockResolvedValue({
    status: "PENDING", metadata: { ticketQuantity: 1 }, eventId: "ev_1", ticketTypeId: "tt_1", userId: "user_g", payment: null,
  })
  mocks.tx.registration.updateMany.mockResolvedValue({ count: 1 })
  mocks.issueFreeTicket.mockResolvedValue({ id: "tkt_1" })
  mocks.prisma.ticket.findUnique.mockResolvedValue({ id: "tkt_1", status: "ACTIVE", metadata: null })
  mocks.sendEmail.mockResolvedValue({ success: true })
})

describe("approving a guest's pending registration", () => {
  it("issues the ticket, creates the guest's view-only link and emails it", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({ email: "guest@example.com", passwordHash: null, _count: { accounts: 0 } })

    const res = await approve()

    expect(res.status).toBe(200)
    expect(mocks.issueFreeTicket).toHaveBeenCalledWith(mocks.tx, expect.objectContaining({ registrationId: "reg_1", userId: "user_g" }))
    // the token's hash is stored on the ticket; the link that goes out matches it
    const stored = mocks.prisma.ticket.update.mock.calls[0][0]
    expect(stored.where).toEqual({ id: "tkt_1" })
    const email = mocks.sendEmail.mock.calls[0][0]
    expect(email.to).toBe("guest@example.com")
    expect(email.subject).toContain("Registration Approved")
    expect(email.html).toContain("Open &lt;Day&gt;")
    const token = decodeURIComponent(/\/events\/open-day\/ticket\/tkt_1\?k=([^"&]+)/.exec(email.html)?.[1] ?? "")
    expect(ticketViewTokenMatches(stored.data.metadata, token)).toBe(true)
    // the in-app notification never carries the token
    expect(JSON.stringify(mocks.prisma.notification.create.mock.calls[0][0])).not.toContain(token)
    // nor does the response to the organizer
    expect(JSON.stringify(await res.json())).not.toContain(token)
  })

  it.each([
    ["has a password", { email: "member@example.com", passwordHash: "$2b$12$x", _count: { accounts: 0 } }],
    ["signs in with Google", { email: "member@example.com", passwordHash: null, _count: { accounts: 1 } }],
  ])("sends no link when the registrant %s", async (_label, user) => {
    mocks.prisma.user.findUnique.mockResolvedValue(user)

    expect((await approve()).status).toBe(200)
    expect(mocks.prisma.ticket.update).not.toHaveBeenCalled()
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })

  it("sends no link when no live ticket was issued", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({ email: "guest@example.com", passwordHash: null, _count: { accounts: 0 } })
    mocks.prisma.ticket.findUnique.mockResolvedValue(null)

    expect((await approve()).status).toBe(200)
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })
})
