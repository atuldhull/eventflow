import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"
import { buildPublicEventsWhere, categoryWhere, liveWorkspaceWhere, publicEventsQuerySchema } from "@/lib/public-events"

// GET /api/events and /api/events/featured: only PUBLIC events in a listed status, the
// category filter is case-insensitive, and query params are validated.
const mocks = vi.hoisted(() => ({
  prisma: { event: { findMany: vi.fn(), count: vi.fn() } },
}))
vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }))

import { GET as listEvents } from "@/app/api/events/route"
import { GET as featuredEvents } from "@/app/api/events/featured/route"

const get = (query: string) => listEvents(new NextRequest(`http://localhost/api/events${query}`))

/** Flattens the AND list of a where clause for easy assertions */
const parts = (where: unknown) => (where as { AND: Record<string, unknown>[] }).AND

beforeEach(() => {
  vi.clearAllMocks()
  mocks.prisma.event.findMany.mockResolvedValue([])
  mocks.prisma.event.count.mockResolvedValue(0)
})

describe("publicEventsQuerySchema", () => {
  it("defaults, ignores empty params and unknown ones", () => {
    const q = publicEventsQuerySchema.parse({ category: "", search: " ", pricing: "", sort: "start_date", order: "asc" })
    expect(q).toMatchObject({ page: 1, upcoming: false })
    expect(q.category).toBeUndefined()
    expect(q.search).toBeUndefined()
    expect(q.pricing).toBeUndefined()
  })

  it("clamps a large limit instead of refusing it", () => {
    expect(publicEventsQuerySchema.parse({ limit: "500" }).limit).toBe(50)
  })

  it("rejects bad values", () => {
    expect(publicEventsQuerySchema.safeParse({ page: "abc" }).success).toBe(false)
    expect(publicEventsQuerySchema.safeParse({ page: "0" }).success).toBe(false)
    expect(publicEventsQuerySchema.safeParse({ pricing: "cheap" }).success).toBe(false)
    expect(publicEventsQuerySchema.safeParse({ orgSlug: "../x" }).success).toBe(false)
    expect(publicEventsQuerySchema.safeParse({ dateFrom: "not-a-date" }).success).toBe(false)
  })
})

describe("buildPublicEventsWhere", () => {
  it("lists PUBLIC events only (never UNLISTED, PRIVATE or INVITE_ONLY), not deleted, in listed statuses", () => {
    const [base] = parts(buildPublicEventsWhere(publicEventsQuerySchema.parse({})))
    expect(base).toEqual({
      deletedAt: null,
      visibility: "PUBLIC",
      status: { in: ["PUBLISHED", "REGISTRATION_OPEN", "ONGOING", "COMPLETED"] },
      // and only while its organization and enterprise are active and not deleted
      ...liveWorkspaceWhere(),
    })
  })

  it("upcoming leaves out completed and ended events", () => {
    const now = new Date("2026-11-09T10:00:00Z")
    const where = parts(buildPublicEventsWhere(publicEventsQuerySchema.parse({ upcoming: "1" }), now))
    expect(where[0].status).toEqual({ in: ["PUBLISHED", "REGISTRATION_OPEN", "ONGOING"] })
    expect(where).toContainEqual({ endDate: { gte: now } })
  })

  it("filters by organization slug and date range", () => {
    const where = parts(buildPublicEventsWhere(publicEventsQuerySchema.parse({ orgSlug: "tech-club", dateFrom: "2026-11-01", dateTo: "2026-11-30" })))
    expect(where).toContainEqual({ organization: { slug: "tech-club", isActive: true, deletedAt: null } })
    expect(where).toContainEqual({ startDate: { gte: new Date("2026-11-01"), lte: new Date("2026-11-30") } })
  })
})

describe("categoryWhere", () => {
  it("matches case-insensitively, with _ and space treated alike", () => {
    expect(categoryWhere("HACKATHON")).toEqual({ OR: [{ category: { equals: "HACKATHON", mode: "insensitive" } }] })
    const team = categoryWhere("TEAM_BUILDING")!.OR!.map((c) => (c.category as { equals: string }).equals)
    expect(team).toEqual(["TEAM_BUILDING", "TEAM BUILDING"])
    const spaced = categoryWhere("Team building")!.OR!.map((c) => (c.category as { equals: string }).equals)
    expect(spaced).toEqual(["Team building", "Team_building"])
  })

  it("ignores All and blanks", () => {
    expect(categoryWhere("All")).toBeNull()
    expect(categoryWhere("  ")).toBeNull()
  })
})

describe("GET /api/events", () => {
  it("queries PUBLIC events with a case-insensitive category and returns the list shape", async () => {
    mocks.prisma.event.findMany.mockResolvedValue([
      { id: "e1", slug: "hack", status: "ONGOING", startDate: new Date("2026-12-01T00:00:00Z"), endDate: new Date("2026-12-02T00:00:00Z") },
      { id: "e2", slug: "old", status: "ONGOING", startDate: new Date("2020-01-01T00:00:00Z"), endDate: new Date("2020-01-02T00:00:00Z") },
    ])
    mocks.prisma.event.count.mockResolvedValue(2)

    const res = await get("?category=HACKATHON&page=1&limit=12")
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toMatchObject({
      success: true,
      // hasEnded lets the card drop "Live now" from an event whose status lags behind its end date
      data: [{ id: "e1", startDate: "2026-12-01T00:00:00.000Z", hasEnded: false }, { id: "e2", hasEnded: true }],
      pagination: { page: 1, pageSize: 12, total: 2, totalPages: 1 },
    })
    const { where, select } = mocks.prisma.event.findMany.mock.calls[0][0]
    expect(parts(where)[0].visibility).toBe("PUBLIC")
    expect(parts(where)).toContainEqual({ OR: [{ category: { equals: "HACKATHON", mode: "insensitive" } }] })
    // no contact details or internal relations in the card
    expect(Object.keys(select)).not.toEqual(expect.arrayContaining(["contactEmail"]))
    expect(select.contactEmail).toBeUndefined()
    expect(select.contactPhone).toBeUndefined()
    expect(select.organization).toEqual({ select: { name: true } })
  })

  it("400s on an invalid query", async () => {
    const res = await get("?page=-3")
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ success: false })
    expect(mocks.prisma.event.findMany).not.toHaveBeenCalled()
  })
})

describe("GET /api/events/featured", () => {
  it("lists featured PUBLIC upcoming events only and returns minPrice as a number", async () => {
    mocks.prisma.event.findMany.mockResolvedValue([
      { id: "e1", startDate: new Date("2026-12-04T00:00:00Z"), endDate: new Date("2026-12-04T03:00:00Z"), ticketTypes: [{ price: "199.00" }] },
    ])
    const res = await featuredEvents()
    const json = await res.json()

    const { where } = mocks.prisma.event.findMany.mock.calls[0][0]
    expect(where).toMatchObject({ visibility: "PUBLIC", deletedAt: null, isFeatured: true })
    expect(where.status).toEqual({ in: ["PUBLISHED", "REGISTRATION_OPEN", "ONGOING"] })
    expect(json.data[0]).toMatchObject({ id: "e1", minPrice: 199 })
    expect(json.data[0].ticketTypes).toBeUndefined()
  })
})
