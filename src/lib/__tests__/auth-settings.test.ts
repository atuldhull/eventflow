import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import bcrypt from "bcryptjs"
import { CredentialsSignin } from "next-auth"
import { DEFAULT_PLATFORM_SETTINGS, type PlatformSettings } from "@/lib/platform-settings"

// Sign-in under Settings → Security / Features: the lockout uses "Max login attempts" and
// "Lockout duration", "Email verification required" can be switched off (never locking out
// a super admin), "Session timeout" ends idle sessions, and a ban ends a session at once.
const prismaMock = vi.hoisted(() => ({ user: { findUnique: vi.fn(), update: vi.fn() } }))
vi.mock("@/lib/prisma", () => ({ default: prismaMock, prisma: prismaMock }))
vi.mock("@/lib/auth-helpers", () => ({ verifyOTP: vi.fn() }))
const platform = vi.hoisted(() => ({ current: null as unknown }))
vi.mock("@/lib/platform-settings-store", () => ({
  getActivePlatformSettings: async () => platform.current,
  getPlatformSettings: async () => ({ settings: platform.current, updatedAt: null }),
}))

type RawAuthorize = (credentials: Record<string, string>, request: Request) => Promise<unknown>
type ProviderEntry = { id: string; options?: { id?: string; authorize?: RawAuthorize } }
type Jwt = (params: Record<string, unknown>) => Promise<Record<string, unknown> | null>

function settings(patch: { features?: Partial<PlatformSettings["features"]>; security?: Partial<PlatformSettings["security"]> } = {}): PlatformSettings {
  const s = structuredClone(DEFAULT_PLATFORM_SETTINGS)
  Object.assign(s.features, patch.features)
  Object.assign(s.security, patch.security)
  return s
}

async function loadConfig() {
  vi.resetModules()
  const { authConfig } = await import("@/lib/auth")
  return authConfig
}
async function passwordAuthorize() {
  const provider = ((await loadConfig()).providers as ProviderEntry[]).find((p) => (p.options?.id ?? p.id) === "credentials")
  const authorize = provider!.options!.authorize!
  return (credentials: Record<string, string>) =>
    authorize(credentials, new Request("http://localhost/api/auth/callback/credentials", { headers: { "x-forwarded-for": "192.0.2.9" } }))
}
async function codeOf(promise: Promise<unknown>) {
  try {
    await promise
    return "no error"
  } catch (error) {
    expect(error).toBeInstanceOf(CredentialsSignin)
    return (error as CredentialsSignin).code
  }
}

const PASSWORD = "Right@12345"
const passwordHash = bcrypt.hashSync(PASSWORD, 4)
const account = (overrides: Record<string, unknown> = {}) => ({
  id: "u1", email: "someone@test.local", name: "Someone", role: "USER", avatar: null, passwordHash,
  isActive: true, isBanned: false, emailVerified: new Date(), deletedAt: null, ...overrides,
})
const right = { email: "someone@test.local", password: PASSWORD }
const wrong = { email: "someone@test.local", password: "Wrong@12345" }

beforeEach(() => {
  platform.current = settings()
  prismaMock.user.findUnique.mockReset()
  prismaMock.user.update.mockReset().mockResolvedValue({})
  vi.stubEnv("GOOGLE_CLIENT_ID", "")
  vi.stubEnv("MICROSOFT_CLIENT_ID", "")
})
afterEach(() => vi.unstubAllEnvs())

describe("login lockout follows the security settings", () => {
  it("locks after Max login attempts, for Lockout duration", async () => {
    platform.current = settings({ security: { maxLoginAttempts: 2, lockoutMinutes: 7 } })
    const authorize = await passwordAuthorize()
    prismaMock.user.findUnique.mockResolvedValue(account())
    expect(await authorize(wrong)).toBeNull()
    expect(await authorize(wrong)).toBeNull()
    expect(await codeOf(authorize(right))).toBe("TOO_MANY_ATTEMPTS:7")
  })

  it("keeps the default 5 attempts / 15 minutes", async () => {
    const authorize = await passwordAuthorize()
    prismaMock.user.findUnique.mockResolvedValue(account())
    for (let i = 0; i < 4; i++) expect(await authorize(wrong)).toBeNull()
    expect(await authorize(right)).toMatchObject({ id: "u1" })
  })
})

describe("email verification required", () => {
  it("refuses an unverified account while on (the default)", async () => {
    const authorize = await passwordAuthorize()
    prismaMock.user.findUnique.mockResolvedValue(account({ emailVerified: null }))
    expect(await codeOf(authorize(right))).toBe("EMAIL_NOT_VERIFIED")
  })

  it("never locks out a super admin, even unverified", async () => {
    const authorize = await passwordAuthorize()
    prismaMock.user.findUnique.mockResolvedValue(account({ emailVerified: null, role: "SUPER_ADMIN" }))
    expect(await authorize(right)).toMatchObject({ role: "SUPER_ADMIN" })
  })

  it("lets an unverified account in when switched off; verified ones are unaffected either way", async () => {
    platform.current = settings({ features: { emailVerificationRequired: false } })
    const authorize = await passwordAuthorize()
    prismaMock.user.findUnique.mockResolvedValue(account({ emailVerified: null }))
    expect(await authorize(right)).toMatchObject({ id: "u1" })
    prismaMock.user.findUnique.mockResolvedValue(account())
    expect(await authorize(right)).toMatchObject({ id: "u1" })
  })
})

describe("session checks", () => {
  const active = { role: "USER", name: "N", email: "e@test.local", avatar: null, isActive: true, isBanned: false, deletedAt: null, metadata: null }

  it("ends a banned account's session on the very next check, not at the 5-minute refresh", async () => {
    const jwt = (await loadConfig()).callbacks!.jwt as unknown as Jwt
    const fresh = { id: "u1", role: "USER", lastRefreshed: Date.now(), authTime: Date.now(), lastActive: Date.now() }
    prismaMock.user.findUnique.mockResolvedValue({ ...active, isBanned: true })
    expect(await jwt({ token: fresh })).toBeNull()
    prismaMock.user.findUnique.mockResolvedValue(active)
    expect(await jwt({ token: fresh })).toMatchObject({ id: "u1" })
  })

  it("ends a session idle longer than Session timeout and keeps an active one going", async () => {
    platform.current = settings({ security: { sessionTimeoutHours: 2 } })
    const jwt = (await loadConfig()).callbacks!.jwt as unknown as Jwt
    prismaMock.user.findUnique.mockResolvedValue(active)
    const now = Date.now()
    expect(await jwt({ token: { id: "u1", role: "USER", lastRefreshed: now, authTime: now - 10 * 3600_000, lastActive: now - 3 * 3600_000 } })).toBeNull()
    const kept = await jwt({ token: { id: "u1", role: "USER", lastRefreshed: now, authTime: now - 10 * 3600_000, lastActive: now - 3600_000 } })
    expect(kept?.lastActive).toBeGreaterThanOrEqual(now)
  })

  it("sets the cookie lifetime to the longest timeout the settings allow", async () => {
    expect((await loadConfig()).session?.maxAge).toBe(720 * 3600)
  })
})
