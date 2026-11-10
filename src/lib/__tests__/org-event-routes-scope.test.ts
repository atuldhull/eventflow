import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

// Tenant isolation for the organizer event / registration routes. Prisma's finders honour
// the org scope of their `where` against an in-memory fixture, so a route that forgets to
// scope a lookup by the authorized organization reaches the other tenant's event and fails.
const EVENTS = [
  { id: "event_a", organizationId: "org_a", title: "A event", status: "DRAFT", slug: "a", startDate: new Date("2027-01-01"), endDate: new Date("2027-01-02"), settings: null, deletedAt: null },
  { id: "event_b", organizationId: "org_b", title: "B event", status: "DRAFT", slug: "b", startDate: new Date("2027-01-01"), endDate: new Date("2027-01-02"), settings: null, deletedAt: null },
]

const prismaMock = vi.hoisted(() => ({
  event: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  registration: { findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn() },
  payment: { aggregate: vi.fn() },
  ticketType: { findMany: vi.fn(), count: vi.fn() },
  $transaction: vi.fn(),
}))
const authMock = vi.hoisted(() => vi.fn())
const authorizeMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/prisma", () => ({ default: prismaMock, prisma: prismaMock }))
vi.mock("@/lib/auth", () => ({ auth: authMock }))
vi.mock("@/lib/authorization", () => ({ authorize: authorizeMock }))
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn(), getClientInfo: () => ({ ipAddress: "127.0.0.1", userAgent: "vitest" }) }))
vi.mock("@/lib/analytics", () => ({ getEventAnalytics: vi.fn(), getEventFunnel: vi.fn() }))

import * as eventRoute from "@/app/api/admin/org/[orgId]/events/[eventId]/route"
import * as addonsRoute from "@/app/api/admin/org/[orgId]/events/[eventId]/addons/route"
import * as analyticsRoute from "@/app/api/admin/org/[orgId]/events/[eventId]/analytics/route"
import * as registrationsRoute from "@/app/api/admin/org/[orgId]/registrations/route"

const req = (url: string, method = "GET", body?: unknown) =>
  new NextRequest(`http://localhost${url}`, { method, body: body === undefined ? undefined : JSON.stringify(body), headers: { "content-type": "application/json" } })
const ctx = <T,>(params: T) => ({ params: Promise.resolve(params) })

beforeEach(() => {
  vi.resetAllMocks()
  authMock.mockResolvedValue({ user: { id: "user_alice", role: "ORG_ADMIN" } })
  // alice is ORG_ADMIN of org_a only
  authorizeMock.mockImplementation(async (_u: string, _p: unknown, c?: { organizationId?: string }) =>
    c?.organizationId === "org_a" ? { authorized: true, role: "ORG_ADMIN" } : { authorized: false, message: "You don't have permission to perform this action." })
  prismaMock.event.findFirst.mockImplementation(async ({ where }: { where: Record<string, unknown> }) =>
    EVENTS.find((e) => e.id === where.id && (where.organizationId === undefined ? true : e.organizationId === where.organizationId)) ?? null)
  prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(prismaMock))
  prismaMock.event.update.mockImplementation(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => ({ ...EVENTS.find((e) => e.id === where.id), ...data }))
  prismaMock.registration.findMany.mockResolvedValue([])
  prismaMock.registration.count.mockResolvedValue(0)
  prismaMock.registration.groupBy.mockResolvedValue([])
})

describe("PATCH /api/admin/org/:orgId/events/:eventId", () => {
  it("can't edit another organization's event through your own org id", async () => {
    const res = await eventRoute.PATCH(req("/api/admin/org/org_a/events/event_b", "PATCH", { title: "Hijacked title" }), ctx({ orgId: "org_a", eventId: "event_b" }))
    expect(res.status).toBe(404)
    expect(prismaMock.event.update).not.toHaveBeenCalled()
  })

  it("is refused in an organization you don't belong to", async () => {
    const res = await eventRoute.PATCH(req("/api/admin/org/org_b/events/event_b", "PATCH", { title: "Hijacked title" }), ctx({ orgId: "org_b", eventId: "event_b" }))
    expect(res.status).toBe(403)
    expect(prismaMock.event.update).not.toHaveBeenCalled()
  })

  it("writes only whitelisted fields of your own event", async () => {
    const res = await eventRoute.PATCH(
      req("/api/admin/org/org_a/events/event_a", "PATCH", { title: "Renamed event", organizationId: "org_b", currentRegistrations: 999 }),
      ctx({ orgId: "org_a", eventId: "event_a" })
    )
    expect(res.status).toBe(200)
    expect(prismaMock.event.update).toHaveBeenCalledWith({ where: { id: "event_a" }, data: { title: "Renamed event" } })
  })
})

describe("DELETE /api/admin/org/:orgId/events/:eventId", () => {
  it("can't delete another organization's event", async () => {
    const res = await eventRoute.DELETE(req("/api/admin/org/org_a/events/event_b", "DELETE"), ctx({ orgId: "org_a", eventId: "event_b" }))
    expect(res.status).toBe(404)
    expect(prismaMock.event.updateMany).not.toHaveBeenCalled()
  })
})

describe("add-ons and analytics", () => {
  it("won't overwrite another organization's add-ons", async () => {
    const res = await addonsRoute.PUT(req("/api/admin/org/org_a/events/event_b/addons", "PUT", { addons: [] }), ctx({ orgId: "org_a", eventId: "event_b" }))
    expect(res.status).toBe(404)
    expect(prismaMock.event.update).not.toHaveBeenCalled()
  })

  it("won't read another organization's add-ons", async () => {
    const res = await addonsRoute.GET(req("/api/admin/org/org_a/events/event_b/addons"), ctx({ orgId: "org_a", eventId: "event_b" }))
    expect(res.status).toBe(404)
  })

  it("won't compute analytics for another organization's event", async () => {
    const res = await analyticsRoute.GET(req("/api/admin/org/org_a/events/event_b/analytics"), ctx({ orgId: "org_a", eventId: "event_b" }))
    expect(res.status).toBe(404)
  })
})

describe("GET /api/admin/org/:orgId/registrations", () => {
  it("filters by event inside the organization's scope", async () => {
    const res = await registrationsRoute.GET(req("/api/admin/org/org_a/registrations?eventId=event_b&search=kav&status=PENDING"), ctx({ orgId: "org_a" }))
    expect(res.status).toBe(200)
    const where = prismaMock.registration.findMany.mock.calls[0][0].where
    expect(where).toMatchObject({ event: { organizationId: "org_a", deletedAt: null }, eventId: "event_b", status: "PENDING" })
    expect(where.OR).toHaveLength(3)
    // the counts use the same scope (org + event)
    expect(prismaMock.registration.groupBy.mock.calls[0][0].where).toEqual({ event: { organizationId: "org_a", deletedAt: null }, eventId: "event_b" })
  })

  it("ignores an unknown status and clamps the page size", async () => {
    await registrationsRoute.GET(req("/api/admin/org/org_a/registrations?status=EVIL&limit=100000"), ctx({ orgId: "org_a" }))
    const args = prismaMock.registration.findMany.mock.calls[0][0]
    expect(args.where.status).toBeUndefined()
    expect(args.take).toBeLessThanOrEqual(100)
  })
})

describe("POST /api/admin/org/:orgId/registrations (add participant)", () => {
  it("is refused in an organization you don't belong to", async () => {
    const res = await registrationsRoute.POST(
      req("/api/admin/org/org_b/registrations", "POST", { eventId: "event_b", name: "Some One", email: "a@b.co", ticketTypeId: "tt" }),
      ctx({ orgId: "org_b" })
    )
    expect(res.status).toBe(403)
  })

  it("validates the body", async () => {
    const res = await registrationsRoute.POST(
      req("/api/admin/org/org_a/registrations", "POST", { eventId: "event_a", name: "S", email: "nope", ticketTypeId: "tt" }),
      ctx({ orgId: "org_a" })
    )
    expect(res.status).toBe(400)
    expect((await res.json()).success).toBe(false)
  })

  it("can't add someone to another organization's event", async () => {
    const res = await registrationsRoute.POST(
      req("/api/admin/org/org_a/registrations", "POST", { eventId: "event_b", name: "Some One", email: "a@b.co", ticketTypeId: "tt" }),
      ctx({ orgId: "org_a" })
    )
    expect(res.status).toBe(404)
  })
})
