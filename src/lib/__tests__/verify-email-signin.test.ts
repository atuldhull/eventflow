import { describe, it, expect, beforeEach, vi } from "vitest"

// /verify-email signs the person in right after a correct code (they have just proven they
// read the inbox, which is what a one-time sign-in code proves), and signup answers a bad
// field with that field's own message instead of "Validation failed".
const prismaMock = vi.hoisted(() => ({ user: { update: vi.fn(), findUnique: vi.fn() } }))
const helpers = vi.hoisted(() => ({ verifyOTP: vi.fn(), createOTP: vi.fn() }))
vi.mock("@/lib/prisma", () => ({ default: prismaMock, prisma: prismaMock }))
vi.mock("@/lib/auth-helpers", () => helpers)
vi.mock("@/lib/email", () => ({ sendWelcomeEmail: vi.fn(), sendOTPEmail: vi.fn() }))
vi.mock("@/lib/org-invites", () => ({ acceptPendingInvites: vi.fn() }))
vi.mock("@/lib/enterprise-invites", () => ({ acceptEnterprisePendingInvites: vi.fn() }))
vi.mock("@/lib/platform-settings-store", async () => {
  const { DEFAULT_PLATFORM_SETTINGS } = await import("@/lib/platform-settings")
  return { getActivePlatformSettings: async () => DEFAULT_PLATFORM_SETTINGS }
})

import * as verifyRoute from "@/app/api/auth/verify-email/route"
import * as signupRoute from "@/app/api/auth/signup/route"

const post = (body: unknown) =>
  new Request("http://localhost/x", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } })
const user = (overrides: Record<string, unknown> = {}) => ({
  id: "u1", email: "new@test.local", name: "New", isActive: true, isBanned: false, deletedAt: null, ...overrides,
})

beforeEach(() => {
  vi.resetAllMocks()
  helpers.verifyOTP.mockResolvedValue({ valid: true })
  helpers.createOTP.mockResolvedValue("123456")
  prismaMock.user.update.mockResolvedValue(user())
})

describe("POST /api/auth/verify-email", () => {
  it("hands back a one-time sign-in code when asked", async () => {
    const res = await verifyRoute.POST(post({ email: "New@Test.local", otp: "654321", signIn: true }))
    expect(res.status).toBe(200)
    expect((await res.json()).data).toEqual({ loginCode: "123456" })
    expect(helpers.createOTP).toHaveBeenCalledWith({ email: "new@test.local", userId: "u1", purpose: "LOGIN" })
  })

  it("only after a correct code, only when asked, and never for a suspended or banned account", async () => {
    expect((await (await verifyRoute.POST(post({ email: "new@test.local", otp: "654321" }))).json()).data).toBeUndefined()

    prismaMock.user.update.mockResolvedValue(user({ isBanned: true }))
    expect((await (await verifyRoute.POST(post({ email: "new@test.local", otp: "654321", signIn: true }))).json()).data).toBeUndefined()

    helpers.verifyOTP.mockResolvedValue({ valid: false, error: "Invalid code" })
    const wrong = await verifyRoute.POST(post({ email: "new@test.local", otp: "000000", signIn: true }))
    expect(wrong.status).toBe(400)
    expect(helpers.createOTP).not.toHaveBeenCalled()
  })
})

describe("POST /api/auth/signup", () => {
  it("names the field that is wrong", async () => {
    const res = await signupRoute.POST(post({
      email: "new@test.local", password: "Right@12345", confirmPassword: "Right@12345", name: "New", phone: "12345", agreeToTerms: true,
    }))
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.message).toBe("Invalid Indian phone number")
    expect(body.errors.phone).toEqual(["Invalid Indian phone number"])
  })
})
