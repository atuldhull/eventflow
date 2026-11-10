import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import bcrypt from "bcryptjs"
import { CredentialsSignin } from "next-auth"

const prismaMock = vi.hoisted(() => ({ user: { findUnique: vi.fn(), update: vi.fn() } }))
vi.mock("@/lib/prisma", () => ({ default: prismaMock, prisma: prismaMock }))
const verifyOTP = vi.hoisted(() => vi.fn())
vi.mock("@/lib/auth-helpers", () => ({ verifyOTP }))

type RawAuthorize = (credentials: Record<string, string>, request: Request) => Promise<unknown>
type Authorize = (credentials: Record<string, string>, ip?: string) => Promise<unknown>
type ProviderEntry = { id: string; options?: { id?: string; authorize?: RawAuthorize } }

// Each load gets fresh modules, so the in-memory failed-login counters start empty
async function loadConfig() {
  vi.resetModules()
  const { authConfig } = await import("@/lib/auth")
  return authConfig
}

/** The provider's authorize, called the way Auth.js calls it: with the sign-in request. */
function authorizeFor(providers: unknown[], id: string): Authorize {
  const provider = (providers as ProviderEntry[]).find((p) => (p.options?.id ?? p.id) === id)
  const authorize = provider?.options?.authorize
  if (!authorize) throw new Error(`no ${id} provider`)
  return (credentials, ip = "192.0.2.1") =>
    authorize(credentials, new Request("http://localhost/api/auth/callback/credentials", { headers: { "x-forwarded-for": ip } }))
}

const PASSWORD = "Right@12345"
const passwordHash = bcrypt.hashSync(PASSWORD, 4)
const account = (overrides: Record<string, unknown> = {}) => ({
  id: "u1",
  email: "someone@test.local",
  name: "Someone",
  role: "USER",
  avatar: null,
  passwordHash,
  isActive: true,
  isBanned: false,
  emailVerified: new Date(),
  deletedAt: null,
  ...overrides,
})

async function codeOf(promise: Promise<unknown>) {
  try {
    await promise
    return "no error"
  } catch (error) {
    expect(error).toBeInstanceOf(CredentialsSignin)
    return (error as CredentialsSignin).code
  }
}

beforeEach(() => {
  prismaMock.user.findUnique.mockReset()
  prismaMock.user.update.mockReset().mockResolvedValue({})
  verifyOTP.mockReset()
  vi.stubEnv("GOOGLE_CLIENT_ID", "")
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "")
  vi.stubEnv("MICROSOFT_CLIENT_ID", "")
  vi.stubEnv("MICROSOFT_CLIENT_SECRET", "")
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("password sign-in", () => {
  it("signs in an active, verified account", async () => {
    const authorize = authorizeFor((await loadConfig()).providers, "credentials")
    prismaMock.user.findUnique.mockResolvedValue(account({ role: "ORG_ADMIN" }))
    expect(await authorize({ email: "Someone@Test.local ", password: PASSWORD })).toMatchObject({ id: "u1", role: "ORG_ADMIN" })
  })

  it.each([
    ["an unknown email", null],
    ["a suspended account", account({ isActive: false })],
    ["a banned account", account({ isBanned: true })],
    ["an unverified account", account({ emailVerified: null })],
    ["a deleted account", account({ deletedAt: new Date() })],
    ["an OAuth-only account", account({ passwordHash: null })],
  ])("gives a plain failure for a wrong password on %s", async (_label, user) => {
    const authorize = authorizeFor((await loadConfig()).providers, "credentials")
    prismaMock.user.findUnique.mockResolvedValue(user)
    expect(await authorize({ email: "someone@test.local", password: "Wrong@12345" })).toBeNull()
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it.each([
    ["ACCOUNT_INACTIVE", { isActive: false }],
    ["ACCOUNT_BANNED", { isBanned: true }],
    ["EMAIL_NOT_VERIFIED", { emailVerified: null }],
  ])("reports %s once the password is right", async (code, overrides) => {
    const authorize = authorizeFor((await loadConfig()).providers, "credentials")
    prismaMock.user.findUnique.mockResolvedValue(account(overrides))
    expect(await codeOf(authorize({ email: "someone@test.local", password: PASSWORD }))).toBe(code)
  })
})

describe("password sign-in rate limit", () => {
  const wrong = { email: "someone@test.local", password: "Wrong@12345" }
  const right = { email: "someone@test.local", password: PASSWORD }

  it("locks an email after 5 failures, even for the right password, and says how long", async () => {
    const authorize = authorizeFor((await loadConfig()).providers, "credentials")
    prismaMock.user.findUnique.mockResolvedValue(account())
    for (let i = 0; i < 5; i++) expect(await authorize(wrong)).toBeNull()
    expect(await codeOf(authorize(right))).toBe("TOO_MANY_ATTEMPTS:15")
    expect(await codeOf(authorize({ ...right, email: " SOMEONE@test.local" }))).toBe("TOO_MANY_ATTEMPTS:15")
  })

  it("treats an unknown email exactly like a real one", async () => {
    const authorize = authorizeFor((await loadConfig()).providers, "credentials")
    prismaMock.user.findUnique.mockResolvedValue(null)
    for (let i = 0; i < 5; i++) expect(await authorize({ email: "nobody@test.local", password: "x" })).toBeNull()
    expect(await codeOf(authorize({ email: "nobody@test.local", password: "x" }))).toBe("TOO_MANY_ATTEMPTS:15")
  })

  it("clears an email's failures when it signs in", async () => {
    const authorize = authorizeFor((await loadConfig()).providers, "credentials")
    prismaMock.user.findUnique.mockResolvedValue(account())
    for (let i = 0; i < 4; i++) await authorize(wrong)
    expect(await authorize(right)).toMatchObject({ id: "u1" })
    for (let i = 0; i < 4; i++) expect(await authorize(wrong)).toBeNull()
    expect(await authorize(right)).toMatchObject({ id: "u1" })
  })

  it("does not count a wrong password from one email against another", async () => {
    const authorize = authorizeFor((await loadConfig()).providers, "credentials")
    prismaMock.user.findUnique.mockResolvedValue(account())
    for (let i = 0; i < 5; i++) await authorize({ ...wrong, email: "other@test.local" })
    expect(await authorize(right)).toMatchObject({ id: "u1" })
  })

  it("locks an IP after 100 failures across any emails", async () => {
    const authorize = authorizeFor((await loadConfig()).providers, "credentials")
    prismaMock.user.findUnique.mockResolvedValue(null)
    for (let i = 0; i < 100; i++) await authorize({ email: `n${i}@test.local`, password: "x" }, "198.51.100.7")
    prismaMock.user.findUnique.mockResolvedValue(account())
    expect(await codeOf(authorize(right, "198.51.100.7"))).toBe("TOO_MANY_ATTEMPTS:15")
    expect(await authorize(right, "198.51.100.8")).toMatchObject({ id: "u1" })
  }, 60_000)
})

describe("OTP sign-in", () => {
  it("rejects a wrong code with a plain failure", async () => {
    const authorize = authorizeFor((await loadConfig()).providers, "otp")
    prismaMock.user.findUnique.mockResolvedValue(account({ isBanned: true }))
    verifyOTP.mockResolvedValue({ valid: false, reason: "invalid" })
    expect(await authorize({ email: "someone@test.local", otp: "000000" })).toBeNull()
  })

  it.each([
    ["expired", "OTP_EXPIRED"],
    ["too_many_attempts", "OTP_ATTEMPTS"],
  ])("explains a %s code", async (reason, code) => {
    const authorize = authorizeFor((await loadConfig()).providers, "otp")
    prismaMock.user.findUnique.mockResolvedValue(account())
    verifyOTP.mockResolvedValue({ valid: false, reason })
    expect(await codeOf(authorize({ email: "someone@test.local", otp: "123456" }))).toBe(code)
  })

  it("checks the account only after the code is right", async () => {
    const authorize = authorizeFor((await loadConfig()).providers, "otp")
    prismaMock.user.findUnique.mockResolvedValue(account({ isBanned: true }))
    verifyOTP.mockResolvedValue({ valid: true })
    expect(await codeOf(authorize({ email: "someone@test.local", otp: "123456" }))).toBe("ACCOUNT_BANNED")
  })

  it("signs in with a right code", async () => {
    const authorize = authorizeFor((await loadConfig()).providers, "otp")
    prismaMock.user.findUnique.mockResolvedValue(account({ role: "SUPER_ADMIN" }))
    verifyOTP.mockResolvedValue({ valid: true })
    expect(await authorize({ email: "someone@test.local", otp: "123456" })).toMatchObject({ role: "SUPER_ADMIN" })
  })
})

describe("social providers", () => {
  const ids = async () => ((await loadConfig()).providers as ProviderEntry[]).map((p) => p.options?.id ?? p.id)

  it("registers none when their credentials are empty", async () => {
    expect(await ids()).toEqual(["credentials", "otp"])
  })

  it("registers the ones that are configured", async () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "id")
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "secret")
    expect(await ids()).toEqual(["google", "credentials", "otp"])
  })
})

describe("session refresh", () => {
  type Jwt = (params: Record<string, unknown>) => Promise<Record<string, unknown> | null>
  const stale = () => ({ id: "u1", role: "ORG_ADMIN", lastRefreshed: Date.now() - 6 * 60 * 1000 })

  it.each([
    ["deleted", null],
    ["deactivated", { role: "ORG_ADMIN", isActive: false, isBanned: false, deletedAt: null }],
    ["banned", { role: "ORG_ADMIN", isActive: true, isBanned: true, deletedAt: null }],
  ])("ends the session of a %s account", async (_label, fresh) => {
    const jwt = (await loadConfig()).callbacks!.jwt as unknown as Jwt
    prismaMock.user.findUnique.mockResolvedValue(fresh)
    expect(await jwt({ token: stale(), trigger: "update" })).toBeNull()
  })

  it("ends a session that signed in before the password was changed", async () => {
    const jwt = (await loadConfig()).callbacks!.jwt as unknown as Jwt
    const signedInAt = Date.now() - 60 * 60 * 1000
    const active = { role: "USER", name: "N", email: "e@test.local", avatar: null, isActive: true, isBanned: false, deletedAt: null }
    prismaMock.user.findUnique.mockResolvedValue({ ...active, metadata: { passwordChangedAt: new Date(signedInAt + 1000).toISOString() } })
    expect(await jwt({ token: { ...stale(), authTime: signedInAt } })).toBeNull()
    // a token from before sign-in times were recorded is older than any change
    expect(await jwt({ token: stale() })).toBeNull()
    // the device that changed it signs straight back in, so its session is newer
    prismaMock.user.findUnique.mockResolvedValue({ ...active, metadata: { passwordChangedAt: new Date(signedInAt - 1000).toISOString() } })
    expect(await jwt({ token: { ...stale(), authTime: signedInAt } })).toMatchObject({ role: "USER" })
  })

  it("records the sign-in time on a new session", async () => {
    const jwt = (await loadConfig()).callbacks!.jwt as unknown as Jwt
    const before = Date.now()
    const token = await jwt({ token: {}, user: { id: "u1", role: "USER" }, trigger: "signIn" })
    expect(token?.authTime).toBeGreaterThanOrEqual(before)
  })

  it("picks up a role change for an active account", async () => {
    const jwt = (await loadConfig()).callbacks!.jwt as unknown as Jwt
    prismaMock.user.findUnique.mockResolvedValue({ role: "USER", name: "N", email: "e@test.local", avatar: null, isActive: true, isBanned: false, deletedAt: null })
    expect(await jwt({ token: stale() })).toMatchObject({ role: "USER" })
  })

  it("session.update() refreshes name, avatar and role from the database at once, ignoring the client's payload", async () => {
    const jwt = (await loadConfig()).callbacks!.jwt as unknown as Jwt
    const now = Date.now()
    const recent = () => ({ id: "u1", role: "ORG_ADMIN", name: "Old Name", avatar: null, lastRefreshed: now - 1000, authTime: now - 60_000 })
    prismaMock.user.findUnique.mockResolvedValue({ role: "USER", name: "New Name", email: "e@test.local", avatar: "/a.png", isActive: true, isBanned: false, deletedAt: null, metadata: {} })

    // a normal read inside the 5-minute window keeps the cached profile
    expect(await jwt({ token: recent() })).toMatchObject({ name: "Old Name", role: "ORG_ADMIN" })
    // update() refreshes now, from the database only
    const updated = await jwt({ token: recent(), trigger: "update", session: { name: "Spoofed", role: "SUPER_ADMIN" } })
    expect(updated).toMatchObject({ name: "New Name", avatar: "/a.png", role: "USER" })
  })

  it("session.update() still ends a session that signed in before a password change", async () => {
    const jwt = (await loadConfig()).callbacks!.jwt as unknown as Jwt
    const now = Date.now()
    prismaMock.user.findUnique.mockResolvedValue({
      role: "USER", name: "N", email: "e@test.local", avatar: null, isActive: true, isBanned: false, deletedAt: null,
      metadata: { passwordChangedAt: new Date(now - 1000).toISOString() },
    })
    expect(await jwt({ token: { id: "u1", role: "USER", lastRefreshed: now - 1000, authTime: now - 60_000 }, trigger: "update" })).toBeNull()
  })
})
