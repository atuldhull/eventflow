import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

// /api/users/me/profile keeps the settings page's notification preferences under
// User.metadata.notificationPreferences. Prisma and auth are stubbed.
const mocks = vi.hoisted(() => ({
  prisma: { user: { findUnique: vi.fn(), update: vi.fn() } },
  auth: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }))
vi.mock("@/lib/auth", () => ({ auth: mocks.auth }))

import { GET, PATCH } from "@/app/api/users/me/profile/route"

const USER_ID = "user_1"
const PROFILE = {
  id: USER_ID, name: "Carol", email: "carol@test.local", phone: null, city: null, bio: null,
  collegeName: null, companyName: null, designation: null, avatar: null,
}

const patch = (body: unknown) =>
  new NextRequest("http://localhost/api/users/me/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

beforeEach(() => {
  vi.resetAllMocks()
  mocks.auth.mockResolvedValue({ user: { id: USER_ID } })
  mocks.prisma.user.update.mockImplementation(async ({ data }: { data: { metadata?: unknown } }) => ({
    ...PROFILE,
    metadata: data.metadata ?? null,
  }))
})

describe("GET /api/users/me/profile", () => {
  it("returns the saved notification preferences without exposing raw metadata", async () => {
    const saved = { marketing: { email: false, inApp: true } }
    mocks.prisma.user.findUnique.mockResolvedValue({ ...PROFILE, metadata: { notificationPreferences: saved, internal: "x" } })

    const json = await (await GET()).json()

    expect(json.success).toBe(true)
    expect(json.data.notificationPreferences).toEqual(saved)
    expect(json.data).not.toHaveProperty("metadata")
    expect(json.data.email).toBe(PROFILE.email)
  })

  it("returns empty preferences when none are saved or the stored value is malformed", async () => {
    mocks.prisma.user.findUnique.mockResolvedValueOnce({ ...PROFILE, metadata: null })
    expect((await (await GET()).json()).data.notificationPreferences).toEqual({})

    mocks.prisma.user.findUnique.mockResolvedValueOnce({ ...PROFILE, metadata: { notificationPreferences: { marketing: { email: "no" } } } })
    expect((await (await GET()).json()).data.notificationPreferences).toEqual({})
  })

  it("requires a session", async () => {
    mocks.auth.mockResolvedValue(null)
    expect((await GET()).status).toBe(401)
  })
})

describe("PATCH /api/users/me/profile", () => {
  it("saves preferences into metadata and keeps the other metadata keys", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({ metadata: { onboarding: "done", notificationPreferences: { old: { email: true, inApp: true } } } })
    const prefs = { marketing: { email: false, inApp: true }, reminder_1h: { email: false, inApp: false } }

    const res = await PATCH(patch({ notificationPreferences: prefs }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(mocks.prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: USER_ID },
      data: { metadata: { onboarding: "done", notificationPreferences: prefs } },
    }))
    expect(json.data.notificationPreferences).toEqual(prefs)
  })

  it.each([
    ["a non-object", [1, 2]],
    ["a non-boolean value", { marketing: { email: "yes", inApp: true } }],
    ["a missing channel", { marketing: { email: true } }],
    ["a bad category key", { "Bad Key": { email: true, inApp: true } }],
  ])("rejects %s", async (_label, notificationPreferences) => {
    const res = await PATCH(patch({ notificationPreferences }))
    expect(res.status).toBe(400)
    expect(mocks.prisma.user.update).not.toHaveBeenCalled()
  })

  it("leaves metadata alone for a plain profile update", async () => {
    const res = await PATCH(patch({ name: "Carol D" }))
    expect(res.status).toBe(200)
    expect(mocks.prisma.user.update.mock.calls[0][0].data).toEqual({ name: "Carol D" })
  })
})
