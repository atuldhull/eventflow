import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

// Route-level tenant isolation tests. Prisma is replaced by an in-memory fixture whose
// finders honour the `where` they are given, so a route that forgets to scope a lookup
// by the authorized org/enterprise gets the other tenant's record back and the test fails.
const prismaMock = vi.hoisted(() => ({
  sitePage: { findFirst: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
  checkIn: { findUnique: vi.fn(), delete: vi.fn() },
  registration: { update: vi.fn() },
  ticket: { update: vi.fn() },
  organizationMember: { findFirst: vi.fn(), update: vi.fn() },
  enterpriseMember: { findFirst: vi.fn(), update: vi.fn() },
}))
const authMock = vi.hoisted(() => vi.fn())
const authorizeMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/prisma", () => ({ default: prismaMock, prisma: prismaMock }))
vi.mock("@/lib/auth", () => ({ auth: authMock }))
vi.mock("@/lib/authorization", () => ({ authorize: authorizeMock, isEnterpriseOwner: async () => false }))
vi.mock("@/lib/audit", () => ({
  createAuditLog: vi.fn(),
  getClientInfo: () => ({ ipAddress: "127.0.0.1", userAgent: "vitest" }),
}))

import * as pageRoute from "@/app/api/admin/org/[orgId]/website/pages/[pageId]/route"
import * as undoRoute from "@/app/api/check-in/undo/route"
import * as removeRoute from "@/app/api/members/[memberId]/remove/route"
import * as roleRoute from "@/app/api/members/[memberId]/role/route"

const ALICE = "user_alice" // ORG_ADMIN of org_a (and ENTERPRISE_ADMIN of ent_a)
const CAROL = "user_carol" // plain participant, no memberships
const ORG_A = "org_a"
const ORG_B = "org_b"
const ENT_A = "ent_a"
const ENT_B = "ent_b"
const EVENT_A = "event_a"
const EVENT_B = "event_b"

const PAGES = [
  { id: "page_a", orgId: ORG_A, title: "About A" },
  { id: "page_b", orgId: ORG_B, title: "About B" },
]
const CHECK_INS = [
  { id: "checkin_a", eventId: EVENT_A, registrationId: "reg_a", ticketId: "tkt_a", userId: CAROL },
  { id: "checkin_b", eventId: EVENT_B, registrationId: "reg_b", ticketId: "tkt_b", userId: CAROL },
]
const ORG_MEMBERS = [
  { id: "om_a", organizationId: ORG_A, userId: "user_a_viewer", role: "VIEWER" },
  { id: "om_b", organizationId: ORG_B, userId: "user_b_viewer", role: "VIEWER" },
]
const ENT_MEMBERS = [
  { id: "em_a", enterpriseId: ENT_A, userId: "user_a_mgr", role: "VIEWER" },
  { id: "em_b", enterpriseId: ENT_B, userId: "user_b_mgr", role: "VIEWER" },
]

type Where = Record<string, unknown>
function matches(where: Where, row: Record<string, unknown>) {
  return Object.entries(where).every(([k, v]) => row[k] === v)
}

function req(url: string, method: string, body?: unknown) {
  return new NextRequest(`http://localhost${url}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  })
}
const ctx = <T,>(params: T) => ({ params: Promise.resolve(params) })

function signIn(userId: string | null, role = "ORG_ADMIN") {
  authMock.mockResolvedValue(userId ? { user: { id: userId, role, name: "Test" } } : null)
}

beforeEach(() => {
  vi.resetAllMocks()

  // alice holds admin permissions in org_a / ent_a / event_a only; carol holds none.
  authorizeMock.mockImplementation(async (userId: string, _perm: unknown, context?: Where) => {
    const ok =
      userId === ALICE &&
      (context?.organizationId === ORG_A || context?.eventId === EVENT_A || context?.enterpriseId === ENT_A)
    // `role` is the caller's role in that context, as the real authorize() reports it.
    const role = context?.enterpriseId ? "ENTERPRISE_ADMIN" : "ORG_ADMIN"
    return ok ? { authorized: true, role } : { authorized: false, message: "You don't have permission to perform this action." }
  })

  prismaMock.sitePage.findFirst.mockImplementation(async ({ where }: { where: { id: string; siteConfig?: { organizationId: string } } }) => {
    const page = PAGES.find((p) => p.id === where.id && (!where.siteConfig || p.orgId === where.siteConfig.organizationId))
    return page ? { id: page.id, title: page.title } : null
  })
  prismaMock.sitePage.update.mockImplementation(async ({ where, data }: { where: { id: string }; data: Where }) => ({ id: where.id, ...data }))
  prismaMock.sitePage.deleteMany.mockImplementation(async ({ where }: { where: { id: string; siteConfig?: { organizationId: string } } }) => ({
    count: PAGES.filter((p) => p.id === where.id && (!where.siteConfig || p.orgId === where.siteConfig.organizationId)).length,
  }))

  prismaMock.checkIn.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => CHECK_INS.find((c) => c.id === where.id) ?? null)

  prismaMock.organizationMember.findFirst.mockImplementation(async ({ where }: { where: Where }) => ORG_MEMBERS.find((m) => matches(where, m)) ?? null)
  prismaMock.enterpriseMember.findFirst.mockImplementation(async ({ where }: { where: Where }) => ENT_MEMBERS.find((m) => matches(where, m)) ?? null)
})

describe("website page route is scoped to the authorized org (bug 2)", () => {
  it("lets an org admin read, edit and delete their own org's page", async () => {
    signIn(ALICE)

    const get = await pageRoute.GET(req("/x", "GET"), ctx({ orgId: ORG_A, pageId: "page_a" }))
    const patch = await pageRoute.PATCH(req("/x", "PATCH", { title: "New" }), ctx({ orgId: ORG_A, pageId: "page_a" }))
    const del = await pageRoute.DELETE(req("/x", "DELETE"), ctx({ orgId: ORG_A, pageId: "page_a" }))

    expect(get.status).toBe(200)
    expect(patch.status).toBe(200)
    expect(prismaMock.sitePage.update).toHaveBeenCalledWith({ where: { id: "page_a" }, data: { title: "New" } })
    expect(del.status).toBe(200)
  })

  it("returns 404 for another org's page requested through the caller's own org URL", async () => {
    signIn(ALICE)

    const get = await pageRoute.GET(req("/x", "GET"), ctx({ orgId: ORG_A, pageId: "page_b" }))
    const patch = await pageRoute.PATCH(req("/x", "PATCH", { title: "DEFACED" }), ctx({ orgId: ORG_A, pageId: "page_b" }))
    const del = await pageRoute.DELETE(req("/x", "DELETE"), ctx({ orgId: ORG_A, pageId: "page_b" }))

    expect(get.status).toBe(404)
    expect(patch.status).toBe(404)
    expect(del.status).toBe(404)
    expect(prismaMock.sitePage.update).not.toHaveBeenCalled()
  })

  it("returns 403 when the caller is not authorized for the org in the URL", async () => {
    signIn(ALICE)

    const patch = await pageRoute.PATCH(req("/x", "PATCH", { title: "DEFACED" }), ctx({ orgId: ORG_B, pageId: "page_b" }))

    expect(patch.status).toBe(403)
    expect(prismaMock.sitePage.findFirst).not.toHaveBeenCalled()
  })
})

describe("check-in undo requires check-in permission on the check-in's event (bug 4)", () => {
  it("rejects a participant with no event role", async () => {
    signIn(CAROL, "USER")

    const res = await undoRoute.POST(req("/api/check-in/undo", "POST", { checkInId: "checkin_a" }))

    expect(res.status).toBe(403)
    expect(prismaMock.checkIn.delete).not.toHaveBeenCalled()
    expect(authorizeMock).toHaveBeenCalledWith(CAROL, "checkin:perform", { eventId: EVENT_A })
  })

  it("rejects an admin of another org", async () => {
    signIn(ALICE)

    const res = await undoRoute.POST(req("/api/check-in/undo", "POST", { checkInId: "checkin_b" }))

    expect(res.status).toBe(403)
    expect(prismaMock.checkIn.delete).not.toHaveBeenCalled()
  })

  it("rejects an eventId that doesn't match the check-in", async () => {
    signIn(ALICE)

    const res = await undoRoute.POST(req("/api/check-in/undo", "POST", { checkInId: "checkin_b", eventId: EVENT_A }))

    expect(res.status).toBe(404)
    expect(prismaMock.checkIn.delete).not.toHaveBeenCalled()
  })

  it("lets an authorized admin undo a check-in on their own event", async () => {
    signIn(ALICE)

    const res = await undoRoute.POST(req("/api/check-in/undo", "POST", { checkInId: "checkin_a" }))

    expect(res.status).toBe(200)
    expect(prismaMock.checkIn.delete).toHaveBeenCalledWith({ where: { id: "checkin_a" } })
    expect(prismaMock.registration.update).toHaveBeenCalledWith({ where: { id: "reg_a" }, data: { status: "CONFIRMED" } })
  })
})

describe("member remove / role change are scoped to the authorized entity (bug 5)", () => {
  it("removes a member of the caller's own org", async () => {
    signIn(ALICE)

    const res = await removeRoute.DELETE(
      req("/x", "DELETE", { entityType: "ORGANIZATION", entityId: ORG_A }),
      ctx({ memberId: "om_a" })
    )

    expect(res.status).toBe(200)
    expect(prismaMock.organizationMember.update).toHaveBeenCalledWith({ where: { id: "om_a" }, data: { isActive: false } })
  })

  it("does not remove another org's member using the caller's own org as entityId", async () => {
    signIn(ALICE)

    const res = await removeRoute.DELETE(
      req("/x", "DELETE", { entityType: "ORGANIZATION", entityId: ORG_A }),
      ctx({ memberId: "om_b" })
    )

    expect(res.status).toBe(404)
    expect(prismaMock.organizationMember.update).not.toHaveBeenCalled()
  })

  it("does not change the role of another org's member", async () => {
    signIn(ALICE)

    const res = await roleRoute.PATCH(
      req("/x", "PATCH", { role: "COORDINATOR", entityType: "ORGANIZATION", entityId: ORG_A }),
      ctx({ memberId: "om_b" })
    )

    expect(res.status).toBe(404)
    expect(prismaMock.organizationMember.update).not.toHaveBeenCalled()
  })

  it("changes the role of a member of the caller's own org", async () => {
    signIn(ALICE)

    const res = await roleRoute.PATCH(
      req("/x", "PATCH", { role: "COORDINATOR", entityType: "ORGANIZATION", entityId: ORG_A }),
      ctx({ memberId: "om_a" })
    )

    expect(res.status).toBe(200)
    expect(prismaMock.organizationMember.update).toHaveBeenCalledWith({ where: { id: "om_a" }, data: { role: "COORDINATOR" } })
  })

  it("applies the same scoping to enterprise members", async () => {
    signIn(ALICE, "ENTERPRISE_ADMIN")

    const remove = await removeRoute.DELETE(
      req("/x", "DELETE", { entityType: "ENTERPRISE", entityId: ENT_A }),
      ctx({ memberId: "em_b" })
    )
    const role = await roleRoute.PATCH(
      req("/x", "PATCH", { role: "COORDINATOR", entityType: "ENTERPRISE", entityId: ENT_A }),
      ctx({ memberId: "em_b" })
    )
    const own = await removeRoute.DELETE(
      req("/x", "DELETE", { entityType: "ENTERPRISE", entityId: ENT_A }),
      ctx({ memberId: "em_a" })
    )

    expect(remove.status).toBe(404)
    expect(role.status).toBe(404)
    expect(own.status).toBe(200)
    expect(prismaMock.enterpriseMember.update).toHaveBeenCalledTimes(1)
    expect(prismaMock.enterpriseMember.update).toHaveBeenCalledWith({ where: { id: "em_a" }, data: { isActive: false } })
  })
})
