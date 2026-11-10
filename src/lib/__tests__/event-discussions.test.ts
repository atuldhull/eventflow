import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

// GET/POST /api/events/[slug]/discussions: private and invite-only threads are for
// attendees and the organizers' team only; drafts have no public thread; input is validated.
const mocks = vi.hoisted(() => ({
  prisma: {
    event: { findFirst: vi.fn() },
    registration: { findFirst: vi.fn() },
    organizationMember: { findFirst: vi.fn() },
    enterpriseMember: { findFirst: vi.fn() },
    notification: { findMany: vi.fn(), create: vi.fn() },
  },
  auth: vi.fn(),
}))
vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }))
vi.mock("@/lib/auth", () => ({ auth: mocks.auth }))

import { GET, POST } from "@/app/api/events/[slug]/discussions/route"

const ctx = { params: Promise.resolve({ slug: "utsav-2026" }) }
const list = (q = "") => GET(new NextRequest(`http://localhost/api/events/utsav-2026/discussions${q}`), ctx)
const post = (body: unknown) =>
  POST(new NextRequest("http://localhost/api/events/utsav-2026/discussions", { method: "POST", body: JSON.stringify(body) }), ctx)

const EVENT = { id: "evt_1", title: "Utsav", visibility: "PUBLIC", status: "REGISTRATION_OPEN", organizationId: "org_1", enterpriseId: null }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.prisma.event.findFirst.mockResolvedValue(EVENT)
  mocks.prisma.notification.findMany.mockResolvedValue([])
  mocks.prisma.registration.findFirst.mockResolvedValue(null)
  mocks.prisma.organizationMember.findFirst.mockResolvedValue(null)
  mocks.prisma.enterpriseMember.findFirst.mockResolvedValue(null)
  mocks.auth.mockResolvedValue(null)
})

describe("GET", () => {
  it("lists a public event's thread for anyone", async () => {
    const res = await list()
    expect(res.status).toBe(200)
    expect(mocks.prisma.event.findFirst.mock.calls[0][0].where).toEqual({ slug: "utsav-2026", deletedAt: null })
  })

  it("400s on a bad page instead of crashing", async () => {
    expect((await list("?page=abc")).status).toBe(400)
  })

  it("hides drafts", async () => {
    mocks.prisma.event.findFirst.mockResolvedValue({ ...EVENT, status: "DRAFT" })
    expect((await list()).status).toBe(404)
  })

  it("private: needs a sign-in, then a registration or membership", async () => {
    mocks.prisma.event.findFirst.mockResolvedValue({ ...EVENT, visibility: "PRIVATE" })
    expect((await list()).status).toBe(401)

    mocks.auth.mockResolvedValue({ user: { id: "u_stranger" } })
    expect((await list()).status).toBe(403)

    mocks.prisma.organizationMember.findFirst.mockResolvedValue({ id: "m1" })
    expect((await list()).status).toBe(200)
  })
})

describe("POST", () => {
  beforeEach(() => mocks.auth.mockResolvedValue({ user: { id: "u1" } }))

  it("validates the message", async () => {
    expect((await post({ message: 42 })).status).toBe(400)
    expect((await post({ message: "   " })).status).toBe(400)
    expect((await post({ message: "x".repeat(501) })).status).toBe(400)
  })

  it("needs a registration that still stands", async () => {
    expect((await post({ message: "Hi" })).status).toBe(403)
    expect(mocks.prisma.registration.findFirst.mock.calls[0][0].where.status.in).not.toContain("CANCELLED")

    mocks.prisma.registration.findFirst.mockResolvedValue({ id: "r1" })
    expect((await post({ message: " Hi " })).status).toBe(201)
    expect(mocks.prisma.notification.create.mock.calls[0][0].data.message).toBe("Hi")
  })
})
