import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"
import { Prisma } from "@prisma/client"

// Super-admin enterprise creation (owner + membership, slug rules), ownership transfer,
// deactivation with a typed name, the enterprise events review (status filter, totals,
// reject with a reason, bulk approve), contact-message status updates and the audit-log
// action filter.
const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  enterpriseMember: { findUnique: vi.fn(), upsert: vi.fn() },
  organizationMember: { findUnique: vi.fn(), findMany: vi.fn() },
  eventTeamMember: { findUnique: vi.fn() },
  organization: { findUnique: vi.fn() },
  enterprise: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  event: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn(), updateMany: vi.fn() },
  contactMessage: { findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  auditLog: { findMany: vi.fn(), count: vi.fn() },
  notification: { create: vi.fn(), createMany: vi.fn() },
  ticketType: { count: vi.fn() },
  $transaction: vi.fn(),
}))
const authMock = vi.hoisted(() => vi.fn())
const auditMock = vi.hoisted(() => vi.fn())
const blockerMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/prisma", () => ({ default: prismaMock, prisma: prismaMock }))
vi.mock("@/lib/auth", () => ({ auth: authMock }))
vi.mock("@/lib/tenant", () => ({ clearTenantCache: vi.fn() }))
vi.mock("@/lib/event-publishing", () => ({ paidTicketsBlocker: blockerMock, PAID_TICKET_WHERE: { isActive: true, price: { gt: 0 } } }))
vi.mock("@/lib/audit", () => ({
  createAuditLog: auditMock,
  getClientInfo: () => ({ ipAddress: "127.0.0.1", userAgent: "vitest" }),
}))

import * as createRoute from "@/app/api/super-admin/enterprises/route"
import * as statusRoute from "@/app/api/super-admin/enterprises/[id]/status/route"
import * as ownerRoute from "@/app/api/admin/enterprise/[enterpriseId]/owner/route"
import * as eventsRoute from "@/app/api/admin/enterprise/[enterpriseId]/events/route"
import * as approveRoute from "@/app/api/admin/enterprise/[enterpriseId]/events/[eventId]/approve/route"
import * as bulkRoute from "@/app/api/admin/enterprise/[enterpriseId]/events/bulk-approve/route"
import * as messagesRoute from "@/app/api/super-admin/contact-messages/route"
import * as auditRoute from "@/app/api/super-admin/audit-logs/route"
import { slugFromName } from "@/lib/enterprise-admin"

const ENT = "ent_1"
const ROLES: Record<string, string> = { super: "SUPER_ADMIN", owner: "USER", coAdmin: "USER", viewer: "USER" }
const MEMBERS: Record<string, string> = { owner: "ENTERPRISE_ADMIN", coAdmin: "ENTERPRISE_ADMIN", viewer: "VIEWER" }
const ACCOUNTS: Record<string, { id: string; name: string; email: string; isActive: boolean; isBanned: boolean; deletedAt: Date | null }> = {
  "owner@test.local": { id: "owner", name: "Owner", email: "owner@test.local", isActive: true, isBanned: false, deletedAt: null },
  "new@test.local": { id: "newOwner", name: "New Owner", email: "new@test.local", isActive: true, isBanned: false, deletedAt: null },
  "banned@test.local": { id: "b", name: "B", email: "banned@test.local", isActive: true, isBanned: true, deletedAt: null },
}
const ENTERPRISE = { id: ENT, name: "Demo University", slug: "demo-university", ownerId: "owner", isActive: true, deletedAt: null, customDomain: null, owner: { email: "owner@test.local" } }

const json = (body: unknown, method = "POST", path = "/x") =>
  new NextRequest(`http://localhost${path}`, { method, body: JSON.stringify(body), headers: { "content-type": "application/json" } })
const get = (path: string) => new NextRequest(`http://localhost${path}`)
const entCtx = { params: Promise.resolve({ enterpriseId: ENT }) }
const idCtx = { params: Promise.resolve({ id: ENT }) }

function signIn(userId: string) {
  authMock.mockResolvedValue({ user: { id: userId, role: ROLES[userId], name: userId, email: `${userId}@test.local` } })
}

beforeEach(() => {
  vi.resetAllMocks()
  prismaMock.user.findUnique.mockImplementation(async ({ where }: { where: { id?: string; email?: string } }) => {
    if (where.id) return ROLES[where.id] ? { role: ROLES[where.id], isActive: true, isBanned: false, deletedAt: null } : null
    return ACCOUNTS[where.email!] ?? null
  })
  prismaMock.enterpriseMember.findUnique.mockImplementation(
    async ({ where }: { where: { enterpriseId_userId: { userId: string } } }) =>
      MEMBERS[where.enterpriseId_userId.userId] ? { role: MEMBERS[where.enterpriseId_userId.userId], isActive: true } : null
  )
  prismaMock.enterprise.findUnique.mockImplementation(async ({ where }: { where: { id?: string; slug?: string } }) =>
    where.id === ENT ? ENTERPRISE : null
  )
  prismaMock.enterprise.findFirst.mockImplementation(async ({ where }: { where: { id: string } }) => (where.id === ENT ? ENTERPRISE : null))
  prismaMock.enterprise.create.mockImplementation(async ({ data }: { data: { name: string; slug: string } }) => ({ id: "ent_new", name: data.name, slug: data.slug }))
  prismaMock.$transaction.mockResolvedValue([])
  prismaMock.organizationMember.findUnique.mockResolvedValue(null)
  prismaMock.organizationMember.findMany.mockResolvedValue([{ userId: "orgAdmin" }])
  prismaMock.eventTeamMember.findUnique.mockResolvedValue(null)
  prismaMock.event.findUnique.mockResolvedValue(null)
  prismaMock.notification.createMany.mockResolvedValue({ count: 1 })
  prismaMock.ticketType.count.mockResolvedValue(0)
  blockerMock.mockResolvedValue(null)
})

describe("creating an enterprise (super admin)", () => {
  const body = { name: "Demo University", slug: "demo-university", email: "events@demo.edu", ownerEmail: "owner@test.local" }

  it("creates it with the owner's ENTERPRISE_ADMIN membership in the same write", async () => {
    signIn("super")
    const res = await createRoute.POST(json({ ...body, slug: "new-slug" }))
    expect(res.status).toBe(201)
    const { data } = prismaMock.enterprise.create.mock.calls[0][0]
    expect(data).toMatchObject({ slug: "new-slug", ownerId: "owner" })
    expect(data.members.create).toMatchObject({ userId: "owner", role: "ENTERPRISE_ADMIN", isActive: true })
    expect(auditMock).toHaveBeenCalledWith(expect.objectContaining({ action: "CREATE", entityType: "ENTERPRISE" }))
  })

  it.each([
    ["uppercase", "Demo-U"],
    ["spaces", "demo u"],
    ["double hyphen", "demo--u"],
    ["leading hyphen", "-demo"],
    ["too short", "d"],
  ])("refuses a bad slug (%s) with a 400", async (_label, slug) => {
    signIn("super")
    const res = await createRoute.POST(json({ ...body, slug }))
    expect(res.status).toBe(400)
    expect(prismaMock.enterprise.create).not.toHaveBeenCalled()
  })

  it("409s a slug in use, and says when it belonged to a deleted enterprise", async () => {
    signIn("super")
    prismaMock.enterprise.findUnique.mockImplementation(async ({ where }: { where: { slug?: string } }) =>
      where.slug === "taken" ? { deletedAt: null } : where.slug === "old" ? { deletedAt: new Date() } : null
    )
    const taken = await createRoute.POST(json({ ...body, slug: "taken" }))
    expect(taken.status).toBe(409)
    const old = await createRoute.POST(json({ ...body, slug: "old" }))
    expect(old.status).toBe(409)
    expect((await old.json()).message).toMatch(/deleted enterprise/)
  })

  it("409s a slug that races in (unique constraint), never a 500", async () => {
    signIn("super")
    prismaMock.enterprise.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "6" }))
    expect((await createRoute.POST(json({ ...body, slug: "racy" }))).status).toBe(409)
  })

  it("400s an unknown or banned owner", async () => {
    signIn("super")
    const unknown = await createRoute.POST(json({ ...body, ownerEmail: "nobody@test.local" }))
    expect(unknown.status).toBe(400)
    expect((await unknown.json()).errors).toHaveProperty("ownerEmail")
    expect((await createRoute.POST(json({ ...body, ownerEmail: "banned@test.local" }))).status).toBe(400)
    expect(prismaMock.enterprise.create).not.toHaveBeenCalled()
  })

  it("is super-admin only", async () => {
    signIn("owner")
    expect((await createRoute.POST(json(body))).status).toBe(403)
  })

  it("suggests slugs from names", () => {
    expect(slugFromName("Demo University!")).toBe("demo-university")
    expect(slugFromName("  École  Normale -- Sup ")).toBe("ecole-normale-sup")
  })
})

describe("transferring ownership", () => {
  const transfer = (body: unknown) => ownerRoute.POST(json(body), entCtx)

  it("is for the owner or a super admin only", async () => {
    signIn("coAdmin")
    expect((await transfer({ newOwnerEmail: "new@test.local", confirm: "Demo University" })).status).toBe(403)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it("needs the typed name and an active account", async () => {
    signIn("owner")
    expect((await transfer({ newOwnerEmail: "new@test.local", confirm: "Demo" })).status).toBe(400)
    expect((await transfer({ newOwnerEmail: "nobody@test.local", confirm: "Demo University" })).status).toBe(400)
    expect((await transfer({ newOwnerEmail: "owner@test.local", confirm: "Demo University" })).status).toBe(409)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it("moves ownership and the ENTERPRISE_ADMIN membership together, audited", async () => {
    signIn("owner")
    const res = await transfer({ newOwnerEmail: "new@test.local", confirm: "demo university" })
    expect(res.status).toBe(200)
    expect(prismaMock.enterprise.update).toHaveBeenCalledWith({ where: { id: ENT }, data: { ownerId: "newOwner" } })
    expect(prismaMock.enterpriseMember.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ userId: "newOwner", role: "ENTERPRISE_ADMIN", isActive: true }),
      update: { role: "ENTERPRISE_ADMIN", isActive: true },
    }))
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    expect(auditMock).toHaveBeenCalledWith(expect.objectContaining({ action: "UPDATE", description: expect.stringMatching(/Transferred ownership/) }))
  })

  it("works for a super admin without a membership", async () => {
    signIn("super")
    expect((await transfer({ newOwnerEmail: "new@test.local", confirm: "demo-university" })).status).toBe(200)
  })
})

describe("deactivating an enterprise", () => {
  it("needs the typed name; activating doesn't", async () => {
    signIn("super")
    expect((await statusRoute.PATCH(json({ isActive: false }, "PATCH"), idCtx)).status).toBe(400)
    expect((await statusRoute.PATCH(json({}, "PATCH"), idCtx)).status).toBe(400) // a toggle of an active one = deactivate
    expect(prismaMock.enterprise.update).not.toHaveBeenCalled()

    const ok = await statusRoute.PATCH(json({ isActive: false, confirm: "Demo University" }, "PATCH"), idCtx)
    expect(ok.status).toBe(200)
    expect(prismaMock.enterprise.update).toHaveBeenCalledWith({ where: { id: ENT }, data: { isActive: false } })

    prismaMock.enterprise.findFirst.mockResolvedValue({ ...ENTERPRISE, isActive: false })
    expect((await statusRoute.PATCH(json({ isActive: true }, "PATCH"), idCtx)).status).toBe(200)
  })
})

describe("enterprise events review", () => {
  beforeEach(() => {
    prismaMock.event.findMany.mockResolvedValue([])
    prismaMock.event.count.mockResolvedValue(0)
    prismaMock.event.groupBy.mockResolvedValue([
      { status: "PENDING_APPROVAL", _count: { _all: 3 } },
      { status: "PUBLISHED", _count: { _all: 5 } },
      { status: "REGISTRATION_OPEN", _count: { _all: 2 } },
      { status: "COMPLETED", _count: { _all: 4 } },
    ])
  })

  it("gives totals over every event and 400s an unknown status", async () => {
    signIn("viewer")
    const res = await eventsRoute.GET(get(`/api/admin/enterprise/${ENT}/events?status=PENDING_APPROVAL&page=2`), entCtx)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.counts).toEqual({ total: 14, pending: 3, published: 7, ongoing: 0, completed: 4, draft: 0 })
    expect(prismaMock.event.findMany.mock.calls[0][0].where.status).toBe("PENDING_APPROVAL")
    expect((await eventsRoute.GET(get(`/api/admin/enterprise/${ENT}/events?status=bogus`), entCtx)).status).toBe(400)
  })

  it("requires a reason to reject, stores it and tells the organization", async () => {
    signIn("owner")
    const ctx = { params: Promise.resolve({ enterpriseId: ENT, eventId: "ev1" }) }
    expect((await approveRoute.POST(json({ action: "reject" }), ctx)).status).toBe(400)
    expect((await approveRoute.POST(json({ action: "reject", reason: " " }), ctx)).status).toBe(400)

    prismaMock.event.findFirst.mockResolvedValue({ id: "ev1", title: "Fest", slug: "fest", organizationId: "org1", createdById: "creator", settings: { other: 1 } })
    prismaMock.event.updateMany.mockResolvedValue({ count: 1 })
    const res = await approveRoute.POST(json({ action: "reject", reason: "Add the venue booking" }), ctx)
    expect(res.status).toBe(200)
    const update = prismaMock.event.updateMany.mock.calls[0][0]
    expect(update.where).toEqual({ id: "ev1", status: "PENDING_APPROVAL" })
    expect(update.data.status).toBe("DRAFT")
    expect(update.data.settings).toMatchObject({ other: 1, approvalDecision: { status: "REJECTED", reason: "Add the venue booking", decidedById: "owner" } })
    const notified = prismaMock.notification.createMany.mock.calls[0][0].data
    expect(notified.map((n: { userId: string }) => n.userId).sort()).toEqual(["creator", "orgAdmin"])
    expect(notified[0].message).toContain("Add the venue booking")
    expect(auditMock).toHaveBeenCalledWith(expect.objectContaining({ action: "REJECT", eventId: "ev1" }))
  })

  it("won't approve (publish) a paid event while payments can't take money, and says why", async () => {
    signIn("owner")
    const ctx = { params: Promise.resolve({ enterpriseId: ENT, eventId: "ev1" }) }
    prismaMock.event.findFirst.mockResolvedValue({ id: "ev1", title: "Gala", slug: "gala", organizationId: null, createdById: "creator", settings: null })
    prismaMock.ticketType.count.mockResolvedValue(2)
    blockerMock.mockResolvedValue("Online payments are switched off on EventFlow right now")
    const res = await approveRoute.POST(json({ action: "approve" }), ctx)
    expect(res.status).toBe(409)
    expect((await res.json()).message).toMatch(/payments are switched off/)
    expect(prismaMock.event.updateMany).not.toHaveBeenCalled()

    const bulk = await bulkRoute.POST(json({ eventIds: ["ev1"] }), entCtx)
    expect(bulk.status).toBe(409)
    expect((await bulk.json()).data.blocked).toEqual([{ eventId: "ev1", message: "Online payments are switched off on EventFlow right now" }])
  })

  it("a viewer can't approve", async () => {
    signIn("viewer")
    const ctx = { params: Promise.resolve({ enterpriseId: ENT, eventId: "ev1" }) }
    expect((await approveRoute.POST(json({ action: "approve" }), ctx)).status).toBe(403)
    expect((await bulkRoute.POST(json({ eventIds: ["ev1"] }), entCtx)).status).toBe(403)
  })

  it("bulk-approves the pending ones and skips the rest", async () => {
    signIn("owner")
    prismaMock.event.findFirst.mockImplementation(async ({ where }: { where: { id: string } }) =>
      where.id === "gone" ? null : { id: where.id, title: where.id, slug: where.id, organizationId: null, createdById: "creator", settings: null }
    )
    prismaMock.event.updateMany.mockResolvedValue({ count: 1 })
    const res = await bulkRoute.POST(json({ eventIds: ["ev1", "ev2", "gone", "ev1"] }), entCtx)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.data).toEqual({ approved: ["ev1", "ev2"], skipped: ["gone"], blocked: [] })
    expect(prismaMock.event.updateMany).toHaveBeenCalledTimes(2)
    expect(prismaMock.event.updateMany.mock.calls[0][0].data.status).toBe("PUBLISHED")

    expect((await bulkRoute.POST(json({ eventIds: [] }), entCtx)).status).toBe(400)
  })
})

describe("contact messages", () => {
  it("accepts only known statuses and 404s an unknown id", async () => {
    signIn("super")
    expect((await messagesRoute.PATCH(json({ id: "m1", status: "HACKED" }, "PATCH"))).status).toBe(400)
    expect((await messagesRoute.PATCH(json({ status: "READ" }, "PATCH"))).status).toBe(400)
    prismaMock.contactMessage.findUnique.mockResolvedValue(null)
    expect((await messagesRoute.PATCH(json({ id: "missing", status: "READ" }, "PATCH"))).status).toBe(404)
    expect(prismaMock.contactMessage.update).not.toHaveBeenCalled()

    prismaMock.contactMessage.findUnique.mockResolvedValue({ status: "NEW", subject: "Hi" })
    prismaMock.contactMessage.update.mockResolvedValue({ id: "m1", status: "READ" })
    expect((await messagesRoute.PATCH(json({ id: "m1", status: "READ" }, "PATCH"))).status).toBe(200)
  })
})

describe("platform audit log", () => {
  it("filters by a known action in any case and 400s an unknown one", async () => {
    signIn("super")
    prismaMock.auditLog.findMany.mockResolvedValue([])
    prismaMock.auditLog.count.mockResolvedValue(0)
    expect((await auditRoute.GET(get("/api/super-admin/audit-logs?action=bogus"))).status).toBe(400)
    expect(prismaMock.auditLog.findMany).not.toHaveBeenCalled()
    expect((await auditRoute.GET(get("/api/super-admin/audit-logs?action=check-in"))).status).toBe(200)
    expect(prismaMock.auditLog.findMany.mock.calls[0][0].where.action).toBe("CHECK_IN")
  })
})
