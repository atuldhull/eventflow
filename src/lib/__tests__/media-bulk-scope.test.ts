import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

// The website media bulk route must only touch media belonging to the org in the URL.
// Prisma is an in-memory store whose finders and writers honour `where`, so a query
// that is not scoped by siteConfigId reaches the other org's media and the test fails.
const prismaMock = vi.hoisted(() => ({
  siteConfig: { findUnique: vi.fn() },
  siteMedia: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
}))
const authMock = vi.hoisted(() => vi.fn())
const authorizeMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/prisma", () => ({ default: prismaMock, prisma: prismaMock }))
vi.mock("@/lib/auth", () => ({ auth: authMock }))
vi.mock("@/lib/authorization", () => ({ authorize: authorizeMock }))

import * as bulkRoute from "@/app/api/admin/org/[orgId]/website/media/bulk/route"

const ALICE = "user_alice" // ORG_EDIT on org_a only
const ORG_A = "org_a"
const ORG_B = "org_b"
const ORG_NO_SITE = "org_no_site"
const SITES: Record<string, string> = { [ORG_A]: "site_a", [ORG_B]: "site_b" }

type Media = { id: string; siteConfigId: string; folder: string; tags: string[] }
let media: Media[] = []

type MediaWhere = { id: string | { in: string[] }; siteConfigId?: string }
function matches(where: MediaWhere, m: Media) {
  const idOk = typeof where.id === "string" ? m.id === where.id : where.id.in.includes(m.id)
  return idOk && (where.siteConfigId === undefined || m.siteConfigId === where.siteConfigId)
}

const bulk = (orgId: string, body: unknown) =>
  bulkRoute.POST(
    new NextRequest("http://localhost/x", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } }),
    { params: Promise.resolve({ orgId }) }
  )
const byId = (id: string) => media.find((m) => m.id === id)

beforeEach(() => {
  vi.resetAllMocks()
  media = [
    { id: "m_a1", siteConfigId: "site_a", folder: "general", tags: ["a"] },
    { id: "m_a2", siteConfigId: "site_a", folder: "general", tags: [] },
    { id: "m_b1", siteConfigId: "site_b", folder: "general", tags: ["b"] },
  ]

  authMock.mockResolvedValue({ user: { id: ALICE, role: "ORG_ADMIN" } })
  authorizeMock.mockImplementation(async (userId: string, _perm: unknown, context?: { organizationId?: string }) =>
    userId === ALICE && (context?.organizationId === ORG_A || context?.organizationId === ORG_NO_SITE)
      ? { authorized: true, role: "ORG_ADMIN" }
      : { authorized: false, message: "You don't have permission to perform this action." }
  )

  prismaMock.siteConfig.findUnique.mockImplementation(async ({ where }: { where: { organizationId: string } }) =>
    SITES[where.organizationId] ? { id: SITES[where.organizationId] } : null
  )
  prismaMock.siteMedia.findMany.mockImplementation(async ({ where }: { where: MediaWhere }) => media.filter((m) => matches(where, m)))
  prismaMock.siteMedia.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => byId(where.id) ?? null)
  prismaMock.siteMedia.update.mockImplementation(async ({ where, data }: { where: { id: string }; data: Partial<Media> }) => {
    const m = byId(where.id)!
    Object.assign(m, data)
    return m
  })
  prismaMock.siteMedia.updateMany.mockImplementation(async ({ where, data }: { where: MediaWhere; data: Partial<Media> }) => {
    const hit = media.filter((m) => matches(where, m))
    hit.forEach((m) => Object.assign(m, data))
    return { count: hit.length }
  })
  prismaMock.siteMedia.deleteMany.mockImplementation(async ({ where }: { where: MediaWhere }) => {
    const before = media.length
    media = media.filter((m) => !matches(where, m))
    return { count: before - media.length }
  })
})

describe("website media bulk route is scoped to the authorized org", () => {
  it("deletes only the caller's org media when another org's id is mixed in", async () => {
    const res = await bulk(ORG_A, { action: "delete", mediaIds: ["m_a1", "m_b1"] })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({ success: true, successCount: 1, failedCount: 0 })
    expect(byId("m_a1")).toBeUndefined()
    expect(byId("m_b1")).toBeDefined()
  })

  it("moves only the caller's org media", async () => {
    const res = await bulk(ORG_A, { action: "move", mediaIds: ["m_a2", "m_b1"], folder: "moved" })

    expect((await res.json()).successCount).toBe(1)
    expect(byId("m_a2")?.folder).toBe("moved")
    expect(byId("m_b1")?.folder).toBe("general")
  })

  it("tags only the caller's org media", async () => {
    const res = await bulk(ORG_A, { action: "tag", mediaIds: ["m_a1", "m_b1"], tags: ["x"] })

    expect((await res.json()).successCount).toBe(1)
    expect(byId("m_a1")?.tags).toEqual(["a", "x"])
    expect(byId("m_b1")?.tags).toEqual(["b"])
  })

  it("returns 403 for an org the caller is not authorized for", async () => {
    const res = await bulk(ORG_B, { action: "delete", mediaIds: ["m_b1"] })

    expect(res.status).toBe(403)
    expect(byId("m_b1")).toBeDefined()
    expect(prismaMock.siteMedia.deleteMany).not.toHaveBeenCalled()
  })

  it("returns 404 when the caller's org has no website, without touching any media", async () => {
    const res = await bulk(ORG_NO_SITE, { action: "delete", mediaIds: ["m_b1"] })

    expect(res.status).toBe(404)
    expect(byId("m_b1")).toBeDefined()
    expect(prismaMock.siteMedia.deleteMany).not.toHaveBeenCalled()
  })

  it("rejects a non-array mediaIds", async () => {
    const res = await bulk(ORG_A, { action: "delete", mediaIds: "m_b1" })

    expect(res.status).toBe(400)
    expect(prismaMock.siteMedia.deleteMany).not.toHaveBeenCalled()
  })
})
