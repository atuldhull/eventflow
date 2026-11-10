import { describe, it, expect, beforeEach, vi } from "vitest"

// acceptPendingInvites: an invitation kept in Organization.settings.pendingInvites becomes a
// membership with the invited role once the invitee's address is verified, exactly once.
// updateOrgSettings is replaced by an in-memory store that applies the same merge.

type Settings = Record<string, unknown>
const store = vi.hoisted(() => ({ settings: new Map<string, Settings>(), members: [] as { id: string; organizationId: string; userId: string; role: string; isActive: boolean }[] }))

const tx = vi.hoisted(() => ({
  organization: { findUnique: vi.fn() },
  organizationMember: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
}))
const prismaMock = vi.hoisted(() => ({ organization: { findMany: vi.fn() } }))
const createNotification = vi.hoisted(() => vi.fn())
const createAuditLog = vi.hoisted(() => vi.fn())

vi.mock("@/lib/prisma", () => ({ default: prismaMock, prisma: prismaMock }))
vi.mock("@/lib/notifications", () => ({ createNotification }))
vi.mock("@/lib/audit", () => ({ createAuditLog }))
vi.mock("@/lib/org-settings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/org-settings")>()
  return {
    ...actual,
    updateOrgSettings: vi.fn(async (orgId: string, change: (current: Settings, t: unknown) => Settings | Promise<Settings>) => {
      const current = store.settings.get(orgId)
      if (!current) return null
      const patch = await change({ ...current }, tx)
      const next = { ...current, ...patch }
      store.settings.set(orgId, next)
      return next
    }),
  }
})

import { acceptPendingInvites } from "@/lib/org-invites"

const USER = { id: "u_new", email: "QA-New@Test.local", name: "New Person" }
const invite = (email: string, role = "COORDINATOR") => ({ email, role, invitedAt: "2026-11-01T00:00:00.000Z", invitedById: "u_admin", invitedByName: "Admin" })

beforeEach(() => {
  vi.clearAllMocks()
  store.settings.clear()
  store.members.length = 0
  store.settings.set("org_a", { pendingInvites: [invite("qa-new@test.local"), invite("someone@else.test")], keep: true })
  store.settings.set("org_b", { pendingInvites: [invite("qa-new@test.local", "VIEWER")] })

  prismaMock.organization.findMany.mockImplementation(async () =>
    [...store.settings.entries()]
      .filter(([, s]) => Array.isArray(s.pendingInvites) && (s.pendingInvites as { email: string }[]).some((i) => i.email === "qa-new@test.local"))
      .map(([id]) => ({ id }))
  )
  tx.organization.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => ({ name: `Org ${where.id}`, isActive: true, deletedAt: null }))
  tx.organizationMember.findUnique.mockImplementation(async ({ where }: { where: { organizationId_userId: { organizationId: string; userId: string } } }) => {
    const { organizationId, userId } = where.organizationId_userId
    return store.members.find((m) => m.organizationId === organizationId && m.userId === userId) ?? null
  })
  tx.organizationMember.create.mockImplementation(async ({ data }: { data: { organizationId: string; userId: string; role: string } }) => {
    const row = { id: `m${store.members.length}`, isActive: true, ...data }
    store.members.push(row)
    return row
  })
  tx.organizationMember.update.mockImplementation(async ({ where, data }: { where: { id: string }; data: { role: string; isActive: boolean } }) => {
    const row = store.members.find((m) => m.id === where.id)!
    Object.assign(row, data)
    return row
  })
})

describe("acceptPendingInvites", () => {
  it("creates a membership with the invited role in every inviting organization and records the acceptance", async () => {
    const accepted = await acceptPendingInvites(USER)

    expect(accepted.map((a) => [a.organizationId, a.role, a.joined])).toEqual([["org_a", "COORDINATOR", true], ["org_b", "VIEWER", true]])
    expect(store.members).toEqual([
      expect.objectContaining({ organizationId: "org_a", userId: "u_new", role: "COORDINATOR", isActive: true, invitedBy: "u_admin" }),
      expect.objectContaining({ organizationId: "org_b", userId: "u_new", role: "VIEWER", isActive: true }),
    ])
    const a = store.settings.get("org_a")!
    expect(a.pendingInvites).toEqual([invite("someone@else.test")])
    expect(a.acceptedInvites).toEqual([expect.objectContaining({ email: "qa-new@test.local", role: "COORDINATOR", userId: "u_new", acceptedAt: expect.any(String) })])
    expect(a.keep).toBe(true)
    // the member and the inviter hear about it, and it is audited
    expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({ userId: "u_new", title: "You've joined Org org_a" }))
    expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({ userId: "u_admin", title: "Invitation accepted" }))
    expect(createAuditLog).toHaveBeenCalledTimes(2)
  })

  it("accepts an invitation exactly once", async () => {
    await acceptPendingInvites(USER)
    vi.clearAllMocks()
    const again = await acceptPendingInvites(USER)

    expect(again).toEqual([])
    expect(store.members).toHaveLength(2)
    expect(createNotification).not.toHaveBeenCalled()
  })

  it("keeps an active member's role, and brings back a removed membership with the invited role", async () => {
    store.members.push({ id: "m_a", organizationId: "org_a", userId: "u_new", role: "ORG_ADMIN", isActive: true })
    store.members.push({ id: "m_b", organizationId: "org_b", userId: "u_new", role: "ORG_ADMIN", isActive: false })

    const accepted = await acceptPendingInvites(USER)

    expect(accepted.map((a) => a.joined)).toEqual([false, true])
    expect(store.members.find((m) => m.id === "m_a")).toMatchObject({ role: "ORG_ADMIN", isActive: true })
    expect(store.members.find((m) => m.id === "m_b")).toMatchObject({ role: "VIEWER", isActive: true })
    expect(tx.organizationMember.create).not.toHaveBeenCalled()
    expect(store.settings.get("org_a")!.pendingInvites).toEqual([invite("someone@else.test")])
  })

  it("leaves an invitation pending when its organization is inactive, or its role is unknown", async () => {
    tx.organization.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
      ({ name: where.id, isActive: where.id !== "org_a", deletedAt: null }))
    store.settings.set("org_b", { pendingInvites: [invite("qa-new@test.local", "SUPER_ADMIN")] })

    expect(await acceptPendingInvites(USER)).toEqual([])
    expect(store.members).toEqual([])
    expect(store.settings.get("org_a")!.pendingInvites).toHaveLength(2)
    expect(store.settings.get("org_b")!.pendingInvites).toHaveLength(1)
  })
})
