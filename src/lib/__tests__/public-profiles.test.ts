import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

// Public organization / enterprise profiles: only active ones, only public fields, only
// PUBLIC events. Prisma is stubbed.
const mocks = vi.hoisted(() => ({
  prisma: {
    organization: { findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    enterprise: { findFirst: vi.fn() },
    organizationMember: { count: vi.fn() },
    enterpriseMember: { count: vi.fn() },
    event: { findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn() },
  },
}))
vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }))

import {
  getPublicEnterprise,
  getPublicOrganization,
  publicSocialLinks,
  safeExternalUrl,
  safeImageSrc,
} from "@/lib/public-profiles"
import { GET as orgRoute } from "@/app/api/public/organizations/[slug]/route"
import { GET as entRoute } from "@/app/api/public/enterprises/[slug]/route"

const ORG = {
  id: "org_internal_id", name: "Tech Club", slug: "tech-club", description: "  We build things.  ", logo: "javascript:alert(1)",
  website: "techclub.example.org", city: "Bengaluru", state: null, country: "India", category: "TECHNICAL", isVerified: false,
  socialLinks: { instagram: "https://instagram.com/techclub", evil: "javascript:alert(1)" },
  enterprise: { name: "Demo University", slug: "demo-university", isActive: true, deletedAt: null },
}

const EVENT_ROW = { id: "e1", slug: "rust", title: "Rust", startDate: new Date("2026-11-22T04:30:00Z"), endDate: new Date("2026-11-22T11:30:00Z"), organization: { name: "Tech Club" } }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.prisma.event.findMany.mockResolvedValue([EVENT_ROW])
  mocks.prisma.event.count.mockResolvedValue(1)
  mocks.prisma.event.groupBy.mockResolvedValue([])
  mocks.prisma.organizationMember.count.mockResolvedValue(3)
  mocks.prisma.enterpriseMember.count.mockResolvedValue(2)
  mocks.prisma.organization.count.mockResolvedValue(0)
  mocks.prisma.organization.findMany.mockResolvedValue([])
})

describe("getPublicOrganization", () => {
  it("looks up active, non-deleted organizations only and never selects contact details", async () => {
    mocks.prisma.organization.findFirst.mockResolvedValue(null)
    expect(await getPublicOrganization("nope")).toBeNull()
    const { where, select } = mocks.prisma.organization.findFirst.mock.calls[0][0]
    expect(where).toEqual({ slug: "nope", isActive: true, deletedAt: null })
    for (const key of ["email", "phone", "address", "settings", "maxEvents"]) expect(select[key]).toBeUndefined()
  })

  it("refuses slugs that aren't slugs without querying", async () => {
    expect(await getPublicOrganization("../../etc")).toBeNull()
    expect(mocks.prisma.organization.findFirst).not.toHaveBeenCalled()
  })

  it("returns public fields, PUBLIC events and counts, and drops unsafe links", async () => {
    mocks.prisma.organization.findFirst.mockResolvedValue(ORG)
    const now = new Date("2026-11-09T00:00:00Z")
    const profile = await getPublicOrganization("tech-club", now)

    expect(profile).toMatchObject({
      kind: "organization",
      name: "Tech Club",
      description: "We build things.",
      logo: null,
      website: { href: "https://techclub.example.org/", label: "techclub.example.org" },
      location: "Bengaluru, India",
      category: "Technical",
      enterprise: { name: "Demo University", slug: "demo-university" },
      socialLinks: [{ href: "https://instagram.com/techclub", label: "Instagram" }],
      counts: { upcomingEvents: 1, pastEvents: 1, members: 3 },
    })
    expect(profile!.upcomingEvents[0]).toMatchObject({ id: "e1", startDate: "2026-11-22T04:30:00.000Z", hasEnded: false })
    // no internal organization id in what we hand out
    expect(JSON.stringify(profile)).not.toContain("org_internal_id")

    // every event query is PUBLIC-only and scoped to this organization
    for (const [args] of mocks.prisma.event.findMany.mock.calls) {
      const [base, scope] = args.where.AND
      expect(base.visibility).toBe("PUBLIC")
      expect(base.deletedAt).toBeNull()
      expect(scope).toEqual({ organizationId: "org_internal_id" })
    }
    // upcoming: not ended; past: completed or ended
    const [upcomingArgs, pastArgs] = mocks.prisma.event.findMany.mock.calls.map((c) => c[0])
    expect(upcomingArgs.where.AND[2]).toEqual({ endDate: { gte: now } })
    expect(upcomingArgs.where.AND[0].status.in).not.toContain("COMPLETED")
    expect(pastArgs.where.AND[2]).toEqual({ OR: [{ status: "COMPLETED" }, { endDate: { lt: now } }] })
  })

  it("hides an organization whose enterprise is deactivated or deleted (it goes off the public site with it)", async () => {
    mocks.prisma.organization.findFirst.mockResolvedValue({ ...ORG, enterprise: { ...ORG.enterprise, isActive: false } })
    expect(await getPublicOrganization("tech-club")).toBeNull()
    mocks.prisma.organization.findFirst.mockResolvedValue({ ...ORG, enterprise: { ...ORG.enterprise, deletedAt: new Date() } })
    expect(await getPublicOrganization("tech-club")).toBeNull()
  })
})

describe("getPublicEnterprise", () => {
  it("lists only active organizations and PUBLIC events of the enterprise", async () => {
    mocks.prisma.enterprise.findFirst.mockResolvedValue({
      id: "ent_1", name: "Demo University", slug: "demo-university", description: null, logo: "/uploads/logo.png", website: null,
      city: null, state: null, country: "India", type: "UNIVERSITY", isVerified: true, socialLinks: null,
    })
    mocks.prisma.organization.findMany.mockResolvedValue([{ id: "org_1", name: "Tech Club", slug: "tech-club", logo: null, category: "TECHNICAL" }])
    mocks.prisma.organization.count.mockResolvedValue(1)
    mocks.prisma.event.groupBy.mockResolvedValue([{ organizationId: "org_1", _count: { _all: 2 } }])

    const profile = await getPublicEnterprise("demo-university")

    expect(mocks.prisma.enterprise.findFirst.mock.calls[0][0].where).toEqual({ slug: "demo-university", isActive: true, deletedAt: null })
    expect(mocks.prisma.organization.findMany.mock.calls[0][0].where).toEqual({ isActive: true, deletedAt: null, enterpriseId: "ent_1" })
    expect(profile).toMatchObject({
      kind: "enterprise",
      logo: "/uploads/logo.png",
      type: "University",
      isVerified: true,
      organizations: [{ name: "Tech Club", slug: "tech-club", category: "Technical", upcomingEvents: 2 }],
      counts: { organizations: 1, members: 2 },
    })
    expect(JSON.stringify(profile)).not.toContain("org_1")
    expect(JSON.stringify(profile)).not.toContain("ent_1")
    for (const [args] of mocks.prisma.event.findMany.mock.calls) expect(args.where.AND[0].visibility).toBe("PUBLIC")
  })
})

describe("API routes", () => {
  const call = (route: typeof orgRoute, slug: string) =>
    route(new NextRequest(`http://localhost/api/public/x/${slug}`), { params: Promise.resolve({ slug }) })

  it("404s for an unknown or inactive organization", async () => {
    mocks.prisma.organization.findFirst.mockResolvedValue(null)
    const res = await call(orgRoute, "ghost-org")
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ success: false, message: "Organization not found" })
  })

  it("404s for a malformed slug without touching the database", async () => {
    const res = await call(entRoute, "a b")
    expect(res.status).toBe(404)
    expect(mocks.prisma.enterprise.findFirst).not.toHaveBeenCalled()
  })

  it("returns { success, message, data } for an active organization", async () => {
    mocks.prisma.organization.findFirst.mockResolvedValue(ORG)
    const res = await call(orgRoute, "tech-club")
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toMatchObject({ success: true, data: { name: "Tech Club", slug: "tech-club" } })
    expect(json.data.email).toBeUndefined()
    expect(json.data.phone).toBeUndefined()
  })
})

describe("link and image sanitising", () => {
  it("keeps http(s) links only", () => {
    expect(safeExternalUrl("https://example.com/club/")).toEqual({ href: "https://example.com/club/", label: "example.com/club" })
    expect(safeExternalUrl("www.example.com")).toEqual({ href: "https://www.example.com/", label: "example.com" })
    expect(safeExternalUrl("javascript:alert(1)")).toBeNull()
    expect(safeExternalUrl("data:text/html,hi")).toBeNull()
    expect(safeExternalUrl("localhost")).toBeNull()
    expect(safeExternalUrl(42)).toBeNull()
  })

  it("keeps http(s) and site-relative images only", () => {
    expect(safeImageSrc("/uploads/a.png")).toBe("/uploads/a.png")
    expect(safeImageSrc("//evil.example/a.png")).toBeNull()
    expect(safeImageSrc("javascript:alert(1)")).toBeNull()
    expect(safeImageSrc("https://cdn.example.com/a.png")).toBe("https://cdn.example.com/a.png")
  })

  it("turns social links JSON into labelled safe links", () => {
    expect(publicSocialLinks({ linkedin: "linkedin.com/company/x", bad: "javascript:x", n: 1 })).toEqual([
      { href: "https://linkedin.com/company/x", label: "LinkedIn" },
    ])
    expect(publicSocialLinks(["https://x.com"])).toEqual([])
  })
})
