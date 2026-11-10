import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

// Bulk approve / reject of events waiting for an enterprise's approval
// (POST /api/admin/enterprise/[enterpriseId]/events/bulk-decision): only that enterprise's
// admins may use it, another enterprise's event ids fail one by one, the list is capped,
// a rejection needs a reason, and every event goes through the single-event decision
// (scoped lookup, status-checked update, notifications, audit log).
const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  enterpriseMember: { findUnique: vi.fn() },
  organizationMember: { findUnique: vi.fn(), findMany: vi.fn() },
  eventTeamMember: { findUnique: vi.fn() },
  organization: { findUnique: vi.fn() },
  enterprise: { findUnique: vi.fn() },
  event: { findUnique: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() },
  notification: { createMany: vi.fn() },
  ticketType: { count: vi.fn() },
}))
const authMock = vi.hoisted(() => vi.fn())
const auditMock = vi.hoisted(() => vi.fn())
const blockerMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/prisma", () => ({ default: prismaMock, prisma: prismaMock }))
vi.mock("@/lib/auth", () => ({ auth: authMock }))
vi.mock("@/lib/event-publishing", () => ({ paidTicketsBlocker: blockerMock, PAID_TICKET_WHERE: { isActive: true, price: { gt: 0 } } }))
vi.mock("@/lib/audit", () => ({
  createAuditLog: auditMock,
  getClientInfo: () => ({ ipAddress: "127.0.0.1", userAgent: "vitest" }),
}))

import * as bulkRoute from "@/app/api/admin/enterprise/[enterpriseId]/events/bulk-decision/route"
import * as singleRoute from "@/app/api/admin/enterprise/[enterpriseId]/events/[eventId]/approve/route"
import { MAX_BULK_DECISIONS, summarizeBulkDecision } from "@/lib/enterprise-event-approval"

const ENT = "ent_1"
const OTHER_ENT = "ent_2"
// enterprise memberships: who is what, in which enterprise
const MEMBERSHIPS: Record<string, Record<string, string>> = {
  [ENT]: { owner: "ENTERPRISE_ADMIN", viewer: "VIEWER" },
  [OTHER_ENT]: { otherAdmin: "ENTERPRISE_ADMIN" },
}
// pending events and the enterprise each belongs to (through its organization)
const EVENTS: Record<string, { enterpriseId: string; title: string; organizationId: string }> = {
  ev1: { enterpriseId: ENT, title: "Fest", organizationId: "org1" },
  ev2: { enterpriseId: ENT, title: "Hackathon", organizationId: "org1" },
  ev3: { enterpriseId: ENT, title: "Gala", organizationId: "org1" },
  foreign: { enterpriseId: OTHER_ENT, title: "Their event", organizationId: "org9" },
}

const json = (body: unknown) =>
  new NextRequest("http://localhost/x", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } })
const ctx = (enterpriseId = ENT) => ({ params: Promise.resolve({ enterpriseId }) })

function signIn(userId: string) {
  authMock.mockResolvedValue({ user: { id: userId, role: "USER", name: userId, email: `${userId}@test.local` } })
}

beforeEach(() => {
  vi.resetAllMocks()
  prismaMock.user.findUnique.mockResolvedValue({ role: "USER", isActive: true, isBanned: false, deletedAt: null })
  prismaMock.enterprise.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
    MEMBERSHIPS[where.id] ? { id: where.id, isActive: true, deletedAt: null } : null
  )
  prismaMock.enterpriseMember.findUnique.mockImplementation(
    async ({ where }: { where: { enterpriseId_userId: { enterpriseId: string; userId: string } } }) => {
      const role = MEMBERSHIPS[where.enterpriseId_userId.enterpriseId]?.[where.enterpriseId_userId.userId]
      return role ? { role, isActive: true } : null
    }
  )
  prismaMock.organizationMember.findUnique.mockResolvedValue(null)
  prismaMock.organizationMember.findMany.mockResolvedValue([{ userId: "orgAdmin" }])
  prismaMock.eventTeamMember.findUnique.mockResolvedValue(null)
  prismaMock.event.findUnique.mockResolvedValue(null)
  // the scoped lookup: an event is found only when the where clause's enterprise matches its own
  prismaMock.event.findFirst.mockImplementation(
    async ({ where }: { where: { id: string; status: string; OR: [{ enterpriseId: string }, { organization: { enterpriseId: string } }] } }) => {
      const ev = EVENTS[where.id]
      if (!ev || where.status !== "PENDING_APPROVAL") return null
      const scoped = where.OR.some((c) => ("enterpriseId" in c ? c.enterpriseId : c.organization.enterpriseId) === ev.enterpriseId)
      return scoped ? { id: where.id, title: ev.title, slug: where.id, organizationId: ev.organizationId, createdById: "creator", settings: null } : null
    }
  )
  prismaMock.event.updateMany.mockResolvedValue({ count: 1 })
  prismaMock.notification.createMany.mockResolvedValue({ count: 2 })
  prismaMock.ticketType.count.mockResolvedValue(0)
  blockerMock.mockResolvedValue(null)
})

describe("bulk approve / reject: who may use it", () => {
  it("401s without a session", async () => {
    authMock.mockResolvedValue(null)
    expect((await bulkRoute.POST(json({ action: "approve", eventIds: ["ev1"] }), ctx())).status).toBe(401)
  })

  it("refuses an enterprise Viewer and an admin of ANOTHER enterprise, deciding nothing", async () => {
    signIn("viewer")
    expect((await bulkRoute.POST(json({ action: "approve", eventIds: ["ev1"] }), ctx())).status).toBe(403)
    signIn("otherAdmin")
    expect((await bulkRoute.POST(json({ action: "approve", eventIds: ["ev1", "ev2"] }), ctx())).status).toBe(403)
    expect((await bulkRoute.POST(json({ action: "reject", eventIds: ["ev1"], reason: "Not ours to run" }), ctx())).status).toBe(403)
    expect(prismaMock.event.findFirst).not.toHaveBeenCalled()
    expect(prismaMock.event.updateMany).not.toHaveBeenCalled()
  })
})

describe("bulk approve / reject: validation", () => {
  it(`caps the list at ${MAX_BULK_DECISIONS} ids and needs at least one`, async () => {
    signIn("owner")
    const many = Array.from({ length: MAX_BULK_DECISIONS + 1 }, (_, i) => `ev${i}`)
    const res = await bulkRoute.POST(json({ action: "approve", eventIds: many }), ctx())
    expect(res.status).toBe(400)
    expect((await res.json()).message).toMatch(/Up to 100/)
    expect((await bulkRoute.POST(json({ action: "approve", eventIds: [] }), ctx())).status).toBe(400)
    expect((await bulkRoute.POST(json({ action: "publish", eventIds: ["ev1"] }), ctx())).status).toBe(400)
    expect(prismaMock.event.updateMany).not.toHaveBeenCalled()

    // exactly at the cap is fine (all unknown ids here, so every one fails on its own)
    const atCap = Array.from({ length: MAX_BULK_DECISIONS }, (_, i) => `missing${i}`)
    const ok = await bulkRoute.POST(json({ action: "approve", eventIds: atCap }), ctx())
    expect(ok.status).toBe(409)
    expect((await ok.json()).data.results).toHaveLength(MAX_BULK_DECISIONS)
  })

  it("a bulk rejection needs one reason of at least 3 characters, like a single one", async () => {
    signIn("owner")
    for (const body of [{ action: "reject", eventIds: ["ev1"] }, { action: "reject", eventIds: ["ev1"], reason: "  " }, { action: "reject", eventIds: ["ev1"], reason: "no" }]) {
      expect((await bulkRoute.POST(json(body), ctx())).status).toBe(400)
      expect((await singleRoute.POST(json({ action: "reject", reason: body.reason }), { params: Promise.resolve({ enterpriseId: ENT, eventId: "ev1" }) })).status).toBe(400)
    }
    expect(prismaMock.event.updateMany).not.toHaveBeenCalled()
  })
})

describe("bulk approve / reject: per-event results", () => {
  it("approves this enterprise's pending events and refuses another enterprise's id on its own", async () => {
    signIn("owner")
    const res = await bulkRoute.POST(json({ action: "approve", eventIds: ["ev1", "foreign", "ev2", "ev1"] }), ctx())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.results).toEqual([
      { id: "ev1", ok: true, message: "Fest is published" },
      { id: "foreign", ok: false, message: "Event not found or not pending approval" },
      { id: "ev2", ok: true, message: "Hackathon is published" },
    ])
    expect(body.message).toBe("Approved 2 of 3 — 1 failed: Event not found or not pending approval")
    // the foreign event was never written to
    const written = prismaMock.event.updateMany.mock.calls.map((c) => c[0].where.id)
    expect(written).toEqual(["ev1", "ev2"])
    // every lookup was scoped to THIS enterprise
    for (const [{ where }] of prismaMock.event.findFirst.mock.calls) {
      expect(where.OR).toEqual([{ enterpriseId: ENT }, { organization: { enterpriseId: ENT } }])
    }
  })

  it("an admin of the other enterprise can't reach this one's events through their own enterprise id", async () => {
    signIn("otherAdmin")
    const res = await bulkRoute.POST(json({ action: "approve", eventIds: ["ev1", "ev2"] }), ctx(OTHER_ENT))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.data.results.every((r: { ok: boolean }) => !r.ok)).toBe(true)
    expect(prismaMock.event.updateMany).not.toHaveBeenCalled()
  })

  it("rejects with the one reason, through the same logic as a single rejection (notifications + audit per event)", async () => {
    signIn("owner")
    const res = await bulkRoute.POST(json({ action: "reject", eventIds: ["ev1", "ev2"], reason: "Add the venue booking" }), ctx())
    expect(res.status).toBe(200)
    expect((await res.json()).message).toBe("Rejected 2 of 2")

    expect(prismaMock.event.updateMany).toHaveBeenCalledTimes(2)
    for (const [{ where, data }] of prismaMock.event.updateMany.mock.calls) {
      expect(where.status).toBe("PENDING_APPROVAL")
      expect(data.status).toBe("DRAFT")
      expect(data.settings.approvalDecision).toMatchObject({ status: "REJECTED", reason: "Add the venue booking", decidedById: "owner" })
    }
    expect(prismaMock.notification.createMany).toHaveBeenCalledTimes(2)
    expect(prismaMock.notification.createMany.mock.calls[0][0].data[0].message).toContain("Add the venue booking")
    expect(auditMock).toHaveBeenCalledTimes(2)
    expect(auditMock).toHaveBeenCalledWith(expect.objectContaining({ action: "REJECT", eventId: "ev1", enterpriseId: ENT }))
    expect(auditMock).toHaveBeenCalledWith(expect.objectContaining({ action: "REJECT", eventId: "ev2", enterpriseId: ENT }))

    // the same event decided singly produces the same writes
    vi.clearAllMocks()
    prismaMock.event.updateMany.mockResolvedValue({ count: 1 })
    prismaMock.notification.createMany.mockResolvedValue({ count: 2 })
    prismaMock.organizationMember.findMany.mockResolvedValue([{ userId: "orgAdmin" }])
    await singleRoute.POST(json({ action: "reject", reason: "Add the venue booking" }), { params: Promise.resolve({ enterpriseId: ENT, eventId: "ev1" }) })
    const single = prismaMock.event.updateMany.mock.calls[0][0]
    expect(single.where).toEqual({ id: "ev1", status: "PENDING_APPROVAL" })
    expect(single.data.status).toBe("DRAFT")
  })

  it("reports a paid event that can't be published, and an unexpected error, without stopping the others", async () => {
    signIn("owner")
    prismaMock.ticketType.count.mockImplementation(async ({ where }: { where: { eventId: string } }) => (where.eventId === "ev2" ? 1 : 0))
    blockerMock.mockResolvedValue("Online payments are switched off on EventFlow right now")
    prismaMock.event.updateMany.mockImplementation(async ({ where }: { where: { id: string } }) => {
      if (where.id === "ev3") throw new Error("db hiccup")
      return { count: 1 }
    })
    const err = vi.spyOn(console, "error").mockImplementation(() => {})
    const res = await bulkRoute.POST(json({ action: "approve", eventIds: ["ev1", "ev2", "ev3"] }), ctx())
    err.mockRestore()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.results).toEqual([
      { id: "ev1", ok: true, message: "Fest is published" },
      { id: "ev2", ok: false, message: "Online payments are switched off on EventFlow right now" },
      { id: "ev3", ok: false, message: "Something went wrong" },
    ])
    expect(body.data).toMatchObject({ succeeded: 1, failed: 2 })
  })

  it("409s when nothing could be decided (all already handled)", async () => {
    signIn("owner")
    prismaMock.event.updateMany.mockResolvedValue({ count: 0 }) // another reviewer got there first
    const res = await bulkRoute.POST(json({ action: "approve", eventIds: ["ev1"] }), ctx())
    expect(res.status).toBe(409)
    expect((await res.json()).success).toBe(false)
    expect(auditMock).not.toHaveBeenCalled()
  })
})

describe("summarizeBulkDecision", () => {
  it("reads like the toast", () => {
    expect(summarizeBulkDecision("approve", [{ id: "a", ok: true, message: "" }])).toBe("Approved 1 of 1")
    expect(
      summarizeBulkDecision("reject", [
        { id: "a", ok: true, message: "" },
        { id: "b", ok: false, message: "X" },
        { id: "c", ok: false, message: "X" },
      ])
    ).toBe("Rejected 1 of 3 — 2 failed: X")
  })
})
