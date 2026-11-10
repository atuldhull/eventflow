import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

// Settings that used to be saved but read by nothing: the enterprise's "Require event
// approval" and "Auto-generate certificates" (and the organization's Event defaults), and
// the platform settings that are now applied (sign-ups, password length, payments,
// certificates, maintenance).

const prismaMock = vi.hoisted(() => ({
  organization: { findUnique: vi.fn() },
  event: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  ticketType: { count: vi.fn() },
  enterpriseMember: { findMany: vi.fn() },
  notification: { createMany: vi.fn() },
  certificateTemplate: { findFirst: vi.fn() },
  user: { findUnique: vi.fn() },
}))
const authMock = vi.hoisted(() => vi.fn())
const authorizeMock = vi.hoisted(() => vi.fn())
const generateBulk = vi.hoisted(() => vi.fn())
const platform = vi.hoisted(() => ({ current: null as unknown }))

vi.mock("@/lib/prisma", () => ({ default: prismaMock, prisma: prismaMock }))
vi.mock("@/lib/auth", () => ({ auth: authMock }))
vi.mock("@/lib/authorization", () => ({ authorize: authorizeMock }))
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn(), getClientInfo: () => ({ ipAddress: "127.0.0.1", userAgent: "vitest" }) }))
vi.mock("@/lib/certificate", () => ({ generateBulkCertificates: generateBulk }))
vi.mock("@/lib/platform-settings-store", () => ({
  getPlatformSettings: async () => ({ settings: platform.current, updatedAt: null }),
  getActivePlatformSettings: async () => platform.current,
}))

import { DEFAULT_PLATFORM_SETTINGS, allowedDuringMaintenance, passwordLengthIssue, type PlatformSettings } from "@/lib/platform-settings"
import { enterpriseRequiresEventApproval, publishOutcome } from "@/lib/event-publishing"
import { issueAutomaticCertificates, wantsAutoCertificates } from "@/lib/auto-certificates"
import * as publishRoute from "@/app/api/admin/org/[orgId]/events/[eventId]/publish/route"
import * as signupRoute from "@/app/api/auth/signup/route"

function settings(patch: { features?: Partial<PlatformSettings["features"]>; security?: Partial<PlatformSettings["security"]> } = {}): PlatformSettings {
  const s = structuredClone(DEFAULT_PLATFORM_SETTINGS)
  Object.assign(s.features, patch.features)
  Object.assign(s.security, patch.security)
  return s
}
const live = { isActive: true, deletedAt: null }

beforeEach(() => {
  vi.clearAllMocks()
  platform.current = settings()
  authMock.mockResolvedValue({ user: { id: "u_org_admin", name: "Org Admin" } })
})

describe("platform settings helpers", () => {
  it("keeps only health, the super-admin area and signing in up during maintenance", () => {
    for (const p of ["/api/health", "/api/health/ready", "/super-admin", "/super-admin/settings", "/api/super-admin/settings", "/login", "/api/auth/csrf", "/api/auth/session", "/api/auth/callback/credentials"]) {
      expect(allowedDuringMaintenance(p)).toBe(true)
    }
    for (const p of ["/", "/events", "/dashboard", "/api/events", "/signup", "/api/auth/signup", "/api/auth/send-otp", "/super-adminx", "/api/registrations"]) {
      expect(allowedDuringMaintenance(p)).toBe(false)
    }
  })
  it("enforces the platform's minimum password length, never below 8", () => {
    expect(passwordLengthIssue("Abcdef1!", settings())).toBeNull()
    expect(passwordLengthIssue("Abcdef1!", settings({ security: { minPasswordLength: 12 } }))).toBe("Password must be at least 12 characters")
    expect(passwordLengthIssue("Abcdef1!xyz1", settings({ security: { minPasswordLength: 12 } }))).toBeNull()
  })
})

describe("signup honours the platform settings", () => {
  const body = { name: "QA Person", email: "qa-settings@test.local", password: "Test@12345", confirmPassword: "Test@12345", agreeToTerms: true }
  const post = (b: unknown) => signupRoute.POST(new Request("http://localhost/api/auth/signup", { method: "POST", body: JSON.stringify(b), headers: { "content-type": "application/json" } }))

  it("refuses sign-ups while user registration is off", async () => {
    platform.current = settings({ features: { userRegistration: false } })
    const res = await post(body)
    expect(res.status).toBe(403)
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
  })
  it("refuses a password shorter than the platform minimum", async () => {
    platform.current = settings({ security: { minPasswordLength: 14 } })
    const res = await post(body)
    expect(res.status).toBe(400)
    expect((await res.json()).message).toBe("Password must be at least 14 characters")
  })
})

describe("enterprise approval before publishing", () => {
  it("reads the enterprise switch", () => {
    expect(enterpriseRequiresEventApproval({ requireEventApproval: true })).toBe(true)
    expect(enterpriseRequiresEventApproval({ requireEventApproval: "yes" })).toBe(false)
    expect(enterpriseRequiresEventApproval(null)).toBe(false)
  })

  it("publishes directly without an enterprise, or when the enterprise doesn't require approval", async () => {
    prismaMock.organization.findUnique.mockResolvedValueOnce({ enterpriseId: null, enterprise: null })
    expect(await publishOutcome("org_a", "u1")).toEqual({ status: "PUBLISHED", enterpriseId: null })
    prismaMock.organization.findUnique.mockResolvedValueOnce({ enterpriseId: "ent_a", enterprise: { settings: {} } })
    expect(await publishOutcome("org_a", "u1")).toEqual({ status: "PUBLISHED", enterpriseId: "ent_a" })
    expect(authorizeMock).not.toHaveBeenCalled()
  })

  it("sends the event for approval unless the publisher can approve for the enterprise", async () => {
    prismaMock.organization.findUnique.mockResolvedValue({ enterpriseId: "ent_a", enterprise: { settings: { requireEventApproval: true } } })
    authorizeMock.mockResolvedValueOnce({ authorized: false })
    expect((await publishOutcome("org_a", "u1")).status).toBe("PENDING_APPROVAL")
    authorizeMock.mockResolvedValueOnce({ authorized: true })
    expect((await publishOutcome("org_a", "ent_admin")).status).toBe("PUBLISHED")
    expect(authorizeMock).toHaveBeenLastCalledWith("ent_admin", "event:publish", { enterpriseId: "ent_a" })
  })

  it("the publish route stores PENDING_APPROVAL and notifies the enterprise's approvers", async () => {
    // the org admin may publish in the org, but not approve in the enterprise
    authorizeMock.mockImplementation(async (_u: string, _p: unknown, c: { organizationId?: string }) => ({ authorized: !!c.organizationId, role: "ORG_ADMIN" }))
    prismaMock.event.findFirst.mockResolvedValue({ title: "Hack Night", status: "DRAFT", startDate: new Date(), endDate: new Date() })
    // one free ticket type (paid ones would also need online payments switched on)
    prismaMock.ticketType.count.mockImplementation(async ({ where }: { where: { price?: unknown } }) => (where.price ? 0 : 1))
    prismaMock.organization.findUnique.mockResolvedValue({ enterpriseId: "ent_a", enterprise: { settings: { requireEventApproval: true } } })
    prismaMock.enterpriseMember.findMany.mockResolvedValue([{ userId: "ent_admin" }])
    prismaMock.notification.createMany.mockResolvedValue({ count: 1 })

    const res = await publishRoute.POST(new NextRequest("http://localhost/x", { method: "POST" }), { params: Promise.resolve({ orgId: "org_a", eventId: "ev_1" }) })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.status).toBe("PENDING_APPROVAL")
    expect(prismaMock.event.update).toHaveBeenCalledWith({ where: { id: "ev_1" }, data: { status: "PENDING_APPROVAL" } })
    expect(prismaMock.notification.createMany.mock.calls[0][0].data).toEqual([expect.objectContaining({ userId: "ent_admin", title: "Event awaiting approval", eventId: "ev_1" })])
  })
})

describe("automatic certificates", () => {
  it("is on when the organization's or a live enterprise's switch is on", () => {
    expect(wantsAutoCertificates({ eventDefaults: { autoGenerateCertificates: true } }, null)).toBe(true)
    expect(wantsAutoCertificates({}, { settings: { autoGenerateCertificates: true }, ...live })).toBe(true)
    expect(wantsAutoCertificates({}, { settings: { autoGenerateCertificates: true }, isActive: false, deletedAt: null })).toBe(false)
    expect(wantsAutoCertificates({ eventDefaults: { autoGenerateCertificates: false } }, { settings: {}, ...live })).toBe(false)
  })

  const event = (id: string, orgSettings: unknown) => ({ id, settings: { other: 1 }, organizationId: "org_a", organization: { settings: orgSettings, enterprise: null } })

  it("issues for finished events where it is on, once, with the default template", async () => {
    prismaMock.event.findMany.mockResolvedValue([
      event("ev_on", { eventDefaults: { autoGenerateCertificates: true } }),
      event("ev_off", {}),
    ])
    prismaMock.certificateTemplate.findFirst.mockResolvedValue({ id: "tpl_default" })
    generateBulk.mockResolvedValue({ total: 3, generated: 3, skipped: 0, failed: 0 })
    const now = new Date("2026-11-09T10:00:00Z")

    const result = await issueAutomaticCertificates(now)

    expect(result).toEqual({ events: 1, generated: 3, disabled: false })
    expect(generateBulk).toHaveBeenCalledTimes(1)
    expect(generateBulk).toHaveBeenCalledWith({ eventId: "ev_on", templateId: "tpl_default", recipientFilter: "checked_in_only" })
    expect(prismaMock.event.update).toHaveBeenCalledWith({ where: { id: "ev_on" }, data: { settings: { other: 1, autoCertificatesIssuedAt: now.toISOString() } } })
    // only events not done yet are looked at
    expect(prismaMock.event.findMany.mock.calls[0][0].where.settings).toMatchObject({ path: ["autoCertificatesIssuedAt"] })
  })

  it("waits for a template, and does nothing while the platform feature is off", async () => {
    prismaMock.event.findMany.mockResolvedValue([event("ev_on", { eventDefaults: { autoGenerateCertificates: true } })])
    prismaMock.certificateTemplate.findFirst.mockResolvedValue(null)
    expect(await issueAutomaticCertificates()).toEqual({ events: 0, generated: 0, disabled: false })
    expect(prismaMock.event.update).not.toHaveBeenCalled()

    platform.current = settings({ features: { certificateGeneration: false } })
    expect(await issueAutomaticCertificates()).toEqual({ events: 0, generated: 0, disabled: true })
    expect(prismaMock.event.findMany).toHaveBeenCalledTimes(1)
  })
})
