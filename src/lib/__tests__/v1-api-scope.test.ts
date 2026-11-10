import crypto from "crypto"
import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

// Public v1 API: an API key reaches only its own tenant's events. Requests go through the
// real withApiAuth and validateApiKey (only the key row is a fixture), and Prisma is an
// in-memory fixture whose finders honour the `where` they are given (AND / OR / NOT,
// relation filters, `in`), so a route that forgets to scope a lookup by the key's
// organization or enterprise hands back another tenant's data and the test fails.
const prismaMock = vi.hoisted(() => ({
  apiKey: { findFirst: vi.fn(), update: vi.fn() },
  event: { findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn() },
  ticket: { findFirst: vi.fn() },
  ticketType: { findFirst: vi.fn() },
  registration: { findMany: vi.fn(), count: vi.fn(), findFirst: vi.fn() },
  checkIn: { findMany: vi.fn(), count: vi.fn() },
  user: { findUnique: vi.fn(), create: vi.fn() },
  organization: { findUnique: vi.fn() },
  subscription: { findFirst: vi.fn() },
}))
vi.mock("@/lib/prisma", () => ({ default: prismaMock, prisma: prismaMock }))

import * as eventsRoute from "@/app/api/v1/events/route"
import * as eventRoute from "@/app/api/v1/events/[eventId]/route"
import * as registrationsRoute from "@/app/api/v1/events/[eventId]/registrations/route"
import * as checkInsRoute from "@/app/api/v1/events/[eventId]/check-ins/route"
import * as verifyRoute from "@/app/api/v1/tickets/[ticketNumber]/verify/route"
import { checkEventLimit } from "@/lib/subscription"

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- loose fixture rows and Prisma args
type Row = Record<string, any>

// ent_a: org_a, org_a2 | ent_b: org_b | org_c: standalone
const ENTERPRISES: Record<string, Row> = {
  ent_a: { id: "ent_a", isActive: true, deletedAt: null },
  ent_b: { id: "ent_b", isActive: true, deletedAt: null },
}
const org = (id: string, enterpriseId: string | null): Row => ({
  id, enterpriseId, isActive: true, deletedAt: null, enterprise: enterpriseId ? ENTERPRISES[enterpriseId] : null,
})
const ORGS: Record<string, Row> = {
  org_a: org("org_a", "ent_a"),
  org_a2: org("org_a2", "ent_a"),
  org_b: org("org_b", "ent_b"),
  org_c: org("org_c", null),
}
const event = (id: string, organizationId: string, enterpriseId: string | null): Row => ({
  id, title: `Event ${id}`, slug: id, organizationId, enterpriseId, deletedAt: null, settings: null,
  status: "PUBLISHED", isPaid: false, approvalRequired: false, maxCapacity: null, currentRegistrations: 0, venue: null,
  startDate: new Date("2026-12-01T10:00:00Z"), endDate: new Date("2026-12-01T18:00:00Z"),
  createdAt: new Date("2026-11-01T00:00:00Z"), updatedAt: new Date("2026-11-01T00:00:00Z"),
  organization: ORGS[organizationId], enterprise: enterpriseId ? ENTERPRISES[enterpriseId] : null,
})
const EVENTS = [
  event("ev_a", "org_a", "ent_a"),
  event("ev_a2", "org_a2", null), // in ent_a only through its organization
  event("ev_b", "org_b", "ent_b"),
  event("ev_c", "org_c", null),
]

const REGISTRATIONS = EVENTS.map((e) => ({
  id: `reg_${e.id}`, eventId: e.id, registrationNumber: `EVT-${e.id}`, status: "CONFIRMED", type: "INDIVIDUAL",
  createdAt: new Date("2026-11-02T00:00:00Z"), checkIn: null,
  user: { name: `Person ${e.id}`, email: `${e.id}@example.com`, phone: null },
  ticketType: { name: "General", price: 0 },
}))
const CHECK_INS = EVENTS.map((e) => ({
  id: `ci_${e.id}`, eventId: e.id, checkedInAt: new Date("2026-12-01T10:05:00Z"), checkInMethod: "QR_SCAN",
  registration: { registrationNumber: `EVT-${e.id}`, user: { name: `Person ${e.id}`, email: `${e.id}@example.com` }, ticketType: { name: "General" } },
}))
const TICKETS = EVENTS.map((e) => ({
  id: `tkt_${e.id}`, ticketNumber: `TKT-${e.id}`, status: "ACTIVE", event: e,
  user: { name: `Person ${e.id}`, email: `${e.id}@example.com` },
  ticketType: { name: "General", price: 0 }, registration: { status: "CONFIRMED", registrationNumber: `EVT-${e.id}` },
}))

const ALL_SCOPES = ["events:write", "registrations:write", "checkins:write"]
const KEYS = [
  { raw: "evf_live_org_a", id: "key_org_a", organizationId: "org_a", enterpriseId: null, scopes: ALL_SCOPES },
  { raw: "evf_live_ent_a", id: "key_ent_a", organizationId: null, enterpriseId: "ent_a", scopes: ALL_SCOPES },
  { raw: "evf_live_org_c", id: "key_org_c", organizationId: "org_c", enterpriseId: null, scopes: ALL_SCOPES },
  // its organization was removed (ApiKey.organizationId is SET NULL on delete)
  { raw: "evf_live_orphan", id: "key_orphan", organizationId: null, enterpriseId: null, scopes: ALL_SCOPES },
  { raw: "evf_live_org_a_ro", id: "key_org_a_ro", organizationId: "org_a", enterpriseId: null, scopes: ["registrations:read"] },
]
const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex")

/** Prisma `where` semantics for the shapes these routes use. */
function matches(row: Row | null | undefined, where: Row | undefined): boolean {
  if (!where) return true
  if (!row) return false
  return Object.entries(where).every(([key, cond]) => {
    if (cond === undefined) return true
    if (key === "AND") return (cond as Row[]).every((w) => matches(row, w))
    if (key === "OR") return (cond as Row[]).some((w) => matches(row, w))
    if (key === "NOT") return !matches(row, cond)
    const value = row[key]
    if (cond !== null && typeof cond === "object" && !(cond instanceof Date)) {
      if ("in" in cond) return (cond.in as unknown[]).includes(value)
      return matches(value, cond) // relation filter
    }
    return value === cond
  })
}

function installFixtures() {
  prismaMock.apiKey.findFirst.mockImplementation(async ({ where }: Row) => {
    const key = KEYS.find((k) => sha256(k.raw) === where.hashedKey)
    return key ? { ...key, name: key.id, isActive: true, expiresAt: null, rateLimit: 1000, requestCount: 0, createdById: "user_dev" } : null
  })
  prismaMock.apiKey.update.mockResolvedValue({})
  prismaMock.event.findFirst.mockImplementation(async ({ where }: Row) => EVENTS.find((e) => matches(e, where)) ?? null)
  prismaMock.event.findMany.mockImplementation(async ({ where }: Row) => EVENTS.filter((e) => matches(e, where)))
  prismaMock.event.count.mockImplementation(async ({ where }: Row) => EVENTS.filter((e) => matches(e, where)).length)
  prismaMock.ticket.findFirst.mockImplementation(async ({ where }: Row) => TICKETS.find((t) => matches(t, where)) ?? null)
  prismaMock.registration.findMany.mockImplementation(async ({ where }: Row) => REGISTRATIONS.filter((r) => matches(r, where)))
  prismaMock.registration.count.mockImplementation(async ({ where }: Row) => REGISTRATIONS.filter((r) => matches(r, where)).length)
  prismaMock.registration.findFirst.mockResolvedValue(null)
  prismaMock.checkIn.findMany.mockImplementation(async ({ where }: Row) => CHECK_INS.filter((c) => matches(c, where)))
  prismaMock.checkIn.count.mockImplementation(async ({ where }: Row) => CHECK_INS.filter((c) => matches(c, where)).length)
  prismaMock.ticketType.findFirst.mockResolvedValue(null)
  prismaMock.organization.findUnique.mockImplementation(async ({ where }: Row) => ORGS[where.id] ?? null)
  // API access is a Pro/Enterprise feature, so tenant-scope tests run on an active Pro plan
  prismaMock.subscription.findFirst.mockResolvedValue({ plan: "PRO", status: "ACTIVE" })
}

beforeEach(() => {
  vi.resetAllMocks()
  installFixtures()
})

const KEY = Object.fromEntries(KEYS.map((k) => [k.id, k.raw])) as Record<string, string>
function call(handler: (req: NextRequest, ctx?: unknown) => Promise<Response>, key: string, path: string, params: Row = {}, body?: unknown) {
  const req = new NextRequest(`http://localhost/api/v1${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  return handler(req, { params: Promise.resolve(params) })
}
const readRegistrations = (key: string, eventId: string) =>
  call(registrationsRoute.GET, key, `/events/${eventId}/registrations`, { eventId })
const register = (key: string, eventId: string) =>
  call(registrationsRoute.POST, key, `/events/${eventId}/registrations`, { eventId }, { participantEmail: "new@example.com", participantName: "New Person" })

async function expectEventNotFound(res: Response) {
  expect(res.status).toBe(404)
  expect(await res.json()).toEqual({ error: { code: "not_found", message: "Event not found" } })
}

describe("v1 API: a key reaches only its own organization's or enterprise's events", () => {
  it("an org key reads its own event's registrations", async () => {
    const res = await readRegistrations(KEY.key_org_a, "ev_a")
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.map((r: Row) => r.participant.email)).toEqual(["ev_a@example.com"])
  })

  it("an org key gets 404 for another organization's event, even one in the same enterprise", async () => {
    await expectEventNotFound(await readRegistrations(KEY.key_org_a, "ev_b"))
    await expectEventNotFound(await readRegistrations(KEY.key_org_a, "ev_a2"))
    await expectEventNotFound(await readRegistrations(KEY.key_org_a, "ev_missing"))
    expect(prismaMock.registration.findMany).not.toHaveBeenCalled()
  })

  it("an enterprise key reads the events of every organization in its enterprise", async () => {
    for (const eventId of ["ev_a", "ev_a2"]) {
      const res = await readRegistrations(KEY.key_ent_a, eventId)
      expect(res.status).toBe(200)
      expect((await res.json()).data[0].participant.email).toBe(`${eventId}@example.com`)
    }
  })

  it("an enterprise key gets 404 for an event outside its enterprise", async () => {
    await expectEventNotFound(await readRegistrations(KEY.key_ent_a, "ev_b"))
    await expectEventNotFound(await readRegistrations(KEY.key_ent_a, "ev_c"))
    expect(prismaMock.registration.findMany).not.toHaveBeenCalled()
  })

  it("a key can't register people for an event outside its tenant; its own event gets past the check", async () => {
    await expectEventNotFound(await register(KEY.key_ent_a, "ev_b"))
    await expectEventNotFound(await register(KEY.key_org_a, "ev_c"))
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
    expect(prismaMock.user.create).not.toHaveBeenCalled()

    // own event: the next step runs (this fixture event has no ticket types)
    const own = await register(KEY.key_ent_a, "ev_a2")
    expect(own.status).toBe(400)
    expect((await own.json()).error.message).toBe("Event has no active ticket types")
  })

  it("scopes still apply: a read-only key can't register", async () => {
    const res = await register(KEY.key_org_a_ro, "ev_a")
    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe("forbidden")
  })

  it("event details are scoped the same way", async () => {
    await expectEventNotFound(await call(eventRoute.GET, KEY.key_ent_a, "/events/ev_b", { eventId: "ev_b" }))
    await expectEventNotFound(await call(eventRoute.GET, KEY.key_org_a, "/events/ev_a2", { eventId: "ev_a2" }))
    const own = await call(eventRoute.GET, KEY.key_ent_a, "/events/ev_a2", { eventId: "ev_a2" })
    expect(own.status).toBe(200)
    expect((await own.json()).data.id).toBe("ev_a2")
  })

  it("check-ins (read and write) are scoped the same way", async () => {
    await expectEventNotFound(await call(checkInsRoute.GET, KEY.key_org_a, "/events/ev_b/check-ins", { eventId: "ev_b" }))
    await expectEventNotFound(await call(checkInsRoute.GET, KEY.key_ent_a, "/events/ev_c/check-ins", { eventId: "ev_c" }))
    expect(prismaMock.checkIn.findMany).not.toHaveBeenCalled()

    await expectEventNotFound(await call(checkInsRoute.POST, KEY.key_ent_a, "/events/ev_b/check-ins", { eventId: "ev_b" }, { ticketNumber: "TKT-ev_b" }))
    expect(prismaMock.registration.findFirst).not.toHaveBeenCalled()

    const own = await call(checkInsRoute.GET, KEY.key_ent_a, "/events/ev_a/check-ins", { eventId: "ev_a" })
    expect(own.status).toBe(200)
    expect((await own.json()).data.map((c: Row) => c.id)).toEqual(["ci_ev_a"])
  })

  it("ticket verification only finds tickets of the key's own events", async () => {
    const other = await call(verifyRoute.GET, KEY.key_ent_a, "/tickets/TKT-ev_b/verify", { ticketNumber: "TKT-ev_b" })
    expect(other.status).toBe(404)
    expect((await other.json()).error.message).toBe("Ticket not found")

    const own = await call(verifyRoute.GET, KEY.key_ent_a, "/tickets/TKT-ev_a2/verify", { ticketNumber: "TKT-ev_a2" })
    expect(own.status).toBe(200)
    expect((await own.json()).data).toMatchObject({ valid: true, ticketNumber: "TKT-ev_a2" })
  })

  it("the event list holds only the key's events; a key linked to no tenant is refused outright", async () => {
    const ids = async (key: string) => (await (await call(eventsRoute.GET, key, "/events")).json()).data.map((e: Row) => e.id).sort()
    expect(await ids(KEY.key_org_a)).toEqual(["ev_a"])
    expect(await ids(KEY.key_ent_a)).toEqual(["ev_a", "ev_a2"])
    // no org or enterprise means no plan, so no API access at all (stricter than an empty list)
    const orphanList = await call(eventsRoute.GET, KEY.key_orphan, "/events")
    expect(orphanList.status).toBe(403)
    expect((await readRegistrations(KEY.key_orphan, "ev_a")).status).toBe(403)
  })
})

describe("POST /api/v1/events: the monthly event limit", () => {
  const NEW_EVENT = {
    title: "API launch party", description: "Created through the public API.",
    startDate: "2026-12-10T10:00:00Z", endDate: "2026-12-10T18:00:00Z",
  }
  const create = (key: string) => call(eventsRoute.POST, key, "/events", {}, NEW_EVENT)

  it("refuses a key whose plan has no API access (Free), before any limit or write", async () => {
    prismaMock.subscription.findFirst.mockResolvedValue(null) // no subscription = FREE, apiAccess false

    const res = await create(KEY.key_org_c)

    expect(res.status).toBe(403)
    expect((await res.json()).error.message).toContain("API access is not included in this plan")
    expect(prismaMock.event.create).not.toHaveBeenCalled()
  })

  it("keeps the monthly limit rule available to v1 create (the same check the admin route uses)", async () => {
    // Plans with API access are unlimited today; the shared rule still reports FREE limits correctly.
    prismaMock.subscription.findFirst.mockResolvedValue(null)
    prismaMock.event.count.mockResolvedValue(5)
    const result = await checkEventLimit("org_c")
    expect(result.allowed).toBe(false)
    expect(result.message).toContain("You've created 5 of 5 events this month on the Free plan.")
    const where = prismaMock.event.count.mock.calls[0][0].where
    expect(where.organizationId).toBe("org_c")
    expect(where.AND).toHaveLength(1) // templates left out
  })

  it("creates the event while the plan has room", async () => {
    prismaMock.event.count.mockResolvedValue(4)
    prismaMock.event.create.mockImplementation(async ({ data }: Row) => ({ id: "ev_new", slug: data.slug, status: data.status }))

    const res = await create(KEY.key_org_c)

    expect(res.status).toBe(201)
    expect((await res.json()).data).toMatchObject({ id: "ev_new", status: "DRAFT" })
    expect(prismaMock.event.create.mock.calls[0][0].data).toMatchObject({ organizationId: "org_c", status: "DRAFT" })
  })

  it("an enterprise key is checked against its enterprise's plan", async () => {
    prismaMock.subscription.findFirst.mockResolvedValue(null) // the enterprise is on FREE: no API access

    const res = await create(KEY.key_ent_a)

    expect(res.status).toBe(403)
    expect((await res.json()).error.message).toContain("API access is not included in this plan")
    expect(prismaMock.subscription.findFirst).toHaveBeenCalledWith({ where: { enterprise: { id: "ent_a" } } })
    expect(prismaMock.event.create).not.toHaveBeenCalled()
  })

  it("a key linked to no organization or enterprise can't create events", async () => {
    const res = await create(KEY.key_orphan)
    expect(res.status).toBe(403)
    expect(prismaMock.event.create).not.toHaveBeenCalled()
  })
})
