import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"
import { DEFAULT_PLATFORM_SETTINGS, normalizePlatformSettings, sessionTimedOut, signInNeedsVerifiedEmail, unavailableSettingIssue, type PlatformSettings } from "@/lib/platform-settings"

// Platform settings that used to save but do nothing: SMS / 2FA / enterprise
// self-registration are refused (not faked), "Public event creation" gates self-service
// organizations, the Google/Microsoft switches hide the buttons, and the signup page can
// ask whether sign-ups are open. Plus: events of a deactivated or deleted workspace are
// off every public surface.
const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), update: vi.fn() },
  organizationMember: { count: vi.fn(), findUnique: vi.fn() },
  enterpriseMember: { findUnique: vi.fn() },
  organization: { findUnique: vi.fn(), create: vi.fn() },
  enterprise: { findUnique: vi.fn() },
  event: { findFirst: vi.fn(), findUnique: vi.fn() },
  eventTeamMember: { findUnique: vi.fn() },
}))
const authMock = vi.hoisted(() => vi.fn())
const handlersGet = vi.hoisted(() => vi.fn())
const platform = vi.hoisted(() => ({ current: null as unknown, saved: vi.fn() }))

vi.mock("@/lib/prisma", () => ({ default: prismaMock, prisma: prismaMock }))
vi.mock("@/lib/auth", () => ({ auth: authMock, handlers: { GET: handlersGet, POST: vi.fn() } }))
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn(), getClientInfo: () => ({ ipAddress: "127.0.0.1", userAgent: "vitest" }) }))
vi.mock("@/lib/platform-settings-store", () => ({
  getActivePlatformSettings: async () => platform.current,
  getPlatformSettings: async () => ({ settings: platform.current, updatedAt: null }),
  savePlatformSettings: platform.saved,
}))

import * as settingsRoute from "@/app/api/super-admin/settings/route"
import * as orgsRoute from "@/app/api/admin/organizations/route"
import * as providersRoute from "@/app/api/auth/[...nextauth]/route"
import * as signupRoute from "@/app/api/auth/signup/route"
import * as eventRoute from "@/app/api/events/[slug]/route"
import { publicListingWhere, liveWorkspaceWhere } from "@/lib/public-events"

function settings(patch: { features?: Partial<PlatformSettings["features"]>; security?: Partial<PlatformSettings["security"]> } = {}): PlatformSettings {
  const s = structuredClone(DEFAULT_PLATFORM_SETTINGS)
  Object.assign(s.features, patch.features)
  Object.assign(s.security, patch.security)
  return s
}
const post = (path: string, body: unknown) =>
  new NextRequest(`http://localhost${path}`, { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } })
const ROLES: Record<string, string> = { super: "SUPER_ADMIN", user: "USER" }
function signIn(id: string) {
  authMock.mockResolvedValue({ user: { id, role: ROLES[id], name: id, email: `${id}@test.local` } })
}

beforeEach(() => {
  vi.resetAllMocks()
  platform.current = settings()
  prismaMock.user.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
    ROLES[where.id] ? { role: ROLES[where.id], isActive: true, isBanned: false, deletedAt: null, emailVerified: new Date() } : null
  )
  prismaMock.organizationMember.count.mockResolvedValue(0)
  prismaMock.organization.findUnique.mockResolvedValue(null)
  prismaMock.organization.create.mockResolvedValue({ id: "org_new", slug: "club", name: "Club" })
})

describe("settings helpers", () => {
  it("reads the unavailable switches as off and refuses to save them on", () => {
    const stored = { features: { smsNotifications: true, enterpriseSelfRegistration: true }, security: { require2faForAdmins: true } }
    const s = normalizePlatformSettings(stored)
    expect(s.features.smsNotifications).toBe(false)
    expect(s.features.enterpriseSelfRegistration).toBe(false)
    expect(s.security.require2faForAdmins).toBe(false)
    expect(unavailableSettingIssue(settings())).toBeNull()
    expect(unavailableSettingIssue(settings({ features: { smsNotifications: true } }))).toMatch(/SMS provider/)
    expect(unavailableSettingIssue(settings({ security: { require2faForAdmins: true } }))).toMatch(/two-factor/)
  })

  it("times out idle sessions and spares super admins from verification", () => {
    const s = settings({ security: { sessionTimeoutHours: 1 } })
    const now = Date.now()
    expect(sessionTimedOut(now - 2 * 3600_000, s, now)).toBe(true)
    expect(sessionTimedOut(now - 30 * 60_000, s, now)).toBe(false)
    expect(sessionTimedOut(undefined, s, now)).toBe(false)
    expect(signInNeedsVerifiedEmail("USER", settings())).toBe(true)
    expect(signInNeedsVerifiedEmail("SUPER_ADMIN", settings())).toBe(false)
    expect(signInNeedsVerifiedEmail("USER", settings({ features: { emailVerificationRequired: false } }))).toBe(false)
  })
})

describe("POST /api/super-admin/settings", () => {
  it("refuses to switch on SMS, 2FA or enterprise self-registration", async () => {
    signIn("super")
    for (const patch of [{ features: { smsNotifications: true } }, { features: { enterpriseSelfRegistration: true } }, { security: { require2faForAdmins: true } }]) {
      const res = await settingsRoute.POST(post("/api/super-admin/settings", settings(patch)))
      expect(res.status).toBe(400)
    }
    expect(platform.saved).not.toHaveBeenCalled()
    expect((await settingsRoute.POST(post("/api/super-admin/settings", settings({ security: { maxLoginAttempts: 3 } })))).status).toBe(200)
    expect(platform.saved).toHaveBeenCalledTimes(1)
  })
})

describe("public event creation (self-service organizations)", () => {
  const body = { name: "Club", slug: "club", email: "club@test.local" }

  it("lets any verified user create one while on (the default)", async () => {
    signIn("user")
    expect((await (await orgsRoute.GET()).json()).data.allowed).toBe(true)
    expect((await orgsRoute.POST(post("/api/admin/organizations", body))).status).toBe(201)
  })

  it("is by invitation only when off, except for org:create holders", async () => {
    platform.current = settings({ features: { publicEventCreation: false } })
    signIn("user")
    expect((await (await orgsRoute.GET()).json()).data).toMatchObject({ allowed: false })
    expect((await orgsRoute.POST(post("/api/admin/organizations", body))).status).toBe(403)
    expect(prismaMock.organization.create).not.toHaveBeenCalled()

    signIn("super")
    expect((await orgsRoute.POST(post("/api/admin/organizations", body))).status).toBe(201)
  })
})

describe("GET /api/auth/providers respects the sign-in switches", () => {
  const providers = { google: { id: "google" }, "microsoft-entra-id": { id: "microsoft-entra-id" }, credentials: { id: "credentials" } }

  it("drops a provider that is switched off", async () => {
    handlersGet.mockImplementation(async () => Response.json(providers))
    platform.current = settings({ features: { googleOAuth: false } })
    const res = await providersRoute.GET(new NextRequest("http://localhost/api/auth/providers"))
    expect(Object.keys(await res.json()).sort()).toEqual(["credentials", "microsoft-entra-id"])

    platform.current = settings()
    const all = await providersRoute.GET(new NextRequest("http://localhost/api/auth/providers"))
    expect(Object.keys(await all.json())).toHaveLength(3)
  })

  it("leaves every other Auth.js endpoint alone", async () => {
    const session = Response.json({ user: null })
    handlersGet.mockResolvedValue(session)
    expect(await providersRoute.GET(new NextRequest("http://localhost/api/auth/session"))).toBe(session)
  })
})

describe("GET /api/auth/signup", () => {
  it("says whether sign-ups are open", async () => {
    expect((await (await signupRoute.GET()).json()).data).toMatchObject({ open: true })
    platform.current = settings({ features: { userRegistration: false } })
    expect((await (await signupRoute.GET()).json()).data).toMatchObject({ open: false })
  })
})

describe("events of a deactivated or deleted workspace are not public", () => {
  it("every listing filters on a live organization and enterprise", () => {
    const where = publicListingWhere()
    expect(where).toMatchObject(liveWorkspaceWhere())
    const json = JSON.stringify(where)
    expect(json).toContain('"organization":{"isActive":true,"deletedAt":null')
    expect(json).toContain('"enterprise":{"isActive":true,"deletedAt":null}')
  })

  it("the event page API answers 404", async () => {
    authMock.mockResolvedValue(null)
    prismaMock.event.findFirst.mockResolvedValue(null) // the liveness filter matched nothing
    const res = await eventRoute.GET(new NextRequest("http://localhost/api/events/fest"), { params: Promise.resolve({ slug: "fest" }) })
    expect(res.status).toBe(404)
    expect(prismaMock.event.findFirst.mock.calls[0][0].where).toMatchObject({ slug: "fest", ...liveWorkspaceWhere() })
  })
})
