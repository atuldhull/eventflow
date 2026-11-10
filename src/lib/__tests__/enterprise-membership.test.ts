import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

// Enterprise membership after the end-to-end round: roles come from the enterprise
// membership (never the global role), read-only roles open the hub, the owner can add
// co-admins, invitations to people without an account are kept (pending), bulk invites,
// a clear 409 for removing someone already removed, and a banned account has no role.
const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  enterpriseMember: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn(), update: vi.fn(), create: vi.fn() },
  organizationMember: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
  eventTeamMember: { findUnique: vi.fn() },
  organization: { findUnique: vi.fn() },
  enterprise: { findUnique: vi.fn(), findFirst: vi.fn() },
  event: { findUnique: vi.fn() },
}))
const authMock = vi.hoisted(() => vi.fn())
const invites = vi.hoisted(() => ({
  addEnterprisePendingInvite: vi.fn(),
  removeEnterprisePendingInvite: vi.fn(),
  readEnterpriseSettings: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({ default: prismaMock, prisma: prismaMock }))
vi.mock("@/lib/auth", () => ({ auth: authMock }))
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn() }))
vi.mock("@/lib/audit", () => ({
  createAuditLog: vi.fn(),
  getClientInfo: () => ({ ipAddress: "127.0.0.1", userAgent: "vitest" }),
}))
vi.mock("@/lib/org-invites", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/org-invites")>()),
  addPendingInvite: vi.fn(),
  removePendingInvite: vi.fn(),
}))
vi.mock("@/lib/enterprise-invites", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/enterprise-invites")>()),
  ...invites,
}))

import * as inviteRoute from "@/app/api/members/invite/route"
import * as removeRoute from "@/app/api/members/[memberId]/remove/route"
import * as roleRoute from "@/app/api/members/[memberId]/role/route"
import * as membersRoute from "@/app/api/admin/enterprise/[enterpriseId]/members/route"
import * as cancelInviteRoute from "@/app/api/admin/enterprise/[enterpriseId]/members/invites/route"
import { authorize, getContextRole } from "@/lib/authorization"
import { PERMISSIONS, canManageEnterpriseRole, getAssignableEnterpriseRoles, getRolePermissions } from "@/lib/permissions"

const ENT = "ent_1"
// Global User.role. The owner and the co-admin are plain USERs globally (invites keep the global role).
const USERS: Record<string, { role: string; isBanned?: boolean }> = {
  owner: { role: "USER" },
  coAdmin: { role: "USER" },
  viewer: { role: "USER" },
  coordinator: { role: "USER" },
  finance: { role: "USER" },
  banned: { role: "USER", isBanned: true },
  super: { role: "SUPER_ADMIN" },
}
const MEMBERS = [
  { id: "em_owner", enterpriseId: ENT, userId: "owner", role: "ENTERPRISE_ADMIN", isActive: true },
  { id: "em_co", enterpriseId: ENT, userId: "coAdmin", role: "ENTERPRISE_ADMIN", isActive: true },
  { id: "em_viewer", enterpriseId: ENT, userId: "viewer", role: "VIEWER", isActive: true },
  { id: "em_coord", enterpriseId: ENT, userId: "coordinator", role: "COORDINATOR", isActive: true },
  { id: "em_fin", enterpriseId: ENT, userId: "finance", role: "FINANCE_MANAGER", isActive: true },
  { id: "em_banned", enterpriseId: ENT, userId: "banned", role: "ENTERPRISE_ADMIN", isActive: true },
  { id: "em_gone", enterpriseId: ENT, userId: "gone", role: "VIEWER", isActive: false },
]
const ENTERPRISE = { id: ENT, name: "Demo U", slug: "demo-u", ownerId: "owner", isActive: true, deletedAt: null, settings: {} }

type Where = Record<string, unknown>
const matches = (where: Where, row: Record<string, unknown>) =>
  Object.entries(where).every(([k, v]) => (typeof v === "object" && v !== null ? true : row[k] === v))

const req = (body: unknown, method = "POST", path = "/x") =>
  new NextRequest(`http://localhost${path}`, { method, body: JSON.stringify(body), headers: { "content-type": "application/json" } })
const get = (path: string) => new NextRequest(`http://localhost${path}`)
const entCtx = { params: Promise.resolve({ enterpriseId: ENT }) }
const memberCtx = (memberId: string) => ({ params: Promise.resolve({ memberId }) })

function signIn(userId: string) {
  authMock.mockResolvedValue({ user: { id: userId, role: USERS[userId]?.role ?? "USER", name: userId } })
}
const invite = (body: Record<string, unknown>) =>
  inviteRoute.POST(req({ role: "VIEWER", entityType: "ENTERPRISE", entityId: ENT, ...body }))

beforeEach(() => {
  vi.resetAllMocks()
  prismaMock.user.findUnique.mockImplementation(async ({ where }: { where: { id?: string; email?: string } }) => {
    if (where.id) {
      const u = USERS[where.id]
      return u ? { role: u.role, isActive: true, isBanned: !!u.isBanned, deletedAt: null } : null
    }
    // by email: only known@test.local has an account
    return where.email === "known@test.local" ? { id: "known", name: "Known" } : null
  })
  prismaMock.enterpriseMember.findUnique.mockImplementation(
    async ({ where }: { where: { enterpriseId_userId: { enterpriseId: string; userId: string } } }) =>
      MEMBERS.find((m) => m.enterpriseId === where.enterpriseId_userId.enterpriseId && m.userId === where.enterpriseId_userId.userId) ?? null
  )
  prismaMock.enterpriseMember.findFirst.mockImplementation(async ({ where }: { where: Where }) => {
    if ("user" in where) return null // invite lookups by email: nobody here is a member yet
    return MEMBERS.find((m) => matches(where, m)) ?? null
  })
  prismaMock.enterpriseMember.findMany.mockResolvedValue([])
  prismaMock.enterpriseMember.count.mockResolvedValue(0)
  prismaMock.enterprise.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => (where.id === ENT ? ENTERPRISE : null))
  prismaMock.enterprise.findFirst.mockImplementation(async ({ where }: { where: { id: string } }) => (where.id === ENT ? ENTERPRISE : null))
  prismaMock.organizationMember.findUnique.mockResolvedValue(null)
  prismaMock.eventTeamMember.findUnique.mockResolvedValue(null)
  prismaMock.event.findUnique.mockResolvedValue(null)
  invites.readEnterpriseSettings.mockResolvedValue({
    pendingInvites: [{ email: "pending@test.local", role: "VIEWER", invitedAt: "2026-11-01T00:00:00.000Z", invitedByName: "Owner" }],
  })
})

describe("enterprise roles come from the membership, not the global role", () => {
  it("an ENTERPRISE_ADMIN whose global role is USER can invite and gets the right role menu", async () => {
    signIn("coAdmin")
    expect((await invite({ email: "new@test.local", role: "ENTERPRISE_MANAGER" })).status).toBe(201)

    const res = await membersRoute.GET(get(`/api/admin/enterprise/${ENT}/members`), entCtx)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.viewer).toMatchObject({ role: "ENTERPRISE_ADMIN", isOwner: false, canInvite: true })
    expect(json.viewer.assignableRoles).toContain("ENTERPRISE_MANAGER")
    expect(json.viewer.assignableRoles).not.toContain("ENTERPRISE_ADMIN")
  })

  it.each([["viewer"], ["coordinator"], ["finance"]])("an enterprise %s opens the hub read-only", async (user) => {
    const role = (await getContextRole(user, { enterpriseId: ENT }))!
    const perms = getRolePermissions(role)
    expect(perms).toContain(PERMISSIONS.ENTERPRISE_VIEW)
    expect(perms).toContain(PERMISSIONS.ORG_VIEW)
    for (const write of [PERMISSIONS.ENTERPRISE_EDIT, PERMISSIONS.MEMBER_INVITE, PERMISSIONS.EVENT_PUBLISH, PERMISSIONS.ORG_EDIT, PERMISSIONS.ENTERPRISE_MANAGE_SETTINGS]) {
      expect(perms).not.toContain(write)
    }
  })

  it("a viewer can list members but not invite", async () => {
    signIn("viewer")
    expect((await membersRoute.GET(get(`/api/admin/enterprise/${ENT}/members`), entCtx)).status).toBe(200)
    expect((await invite({ email: "x@test.local" })).status).toBe(403)
  })
})

describe("co-admins", () => {
  it("the owner can invite another ENTERPRISE_ADMIN; another admin can't", async () => {
    signIn("owner")
    expect((await invite({ email: "known@test.local", role: "ENTERPRISE_ADMIN" })).status).toBe(201)
    expect(prismaMock.enterpriseMember.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ enterpriseId: ENT, userId: "known", role: "ENTERPRISE_ADMIN", isActive: true }),
    })

    signIn("coAdmin")
    const refused = await invite({ email: "other@test.local", role: "ENTERPRISE_ADMIN" })
    expect(refused.status).toBe(403)
    expect((await refused.json()).message).toMatch(/owner/i)
  })

  it("the owner can re-role and remove a co-admin; a co-admin can't touch another co-admin", async () => {
    signIn("coAdmin")
    expect((await removeRoute.DELETE(req({ entityType: "ENTERPRISE", entityId: ENT }, "DELETE"), memberCtx("em_banned"))).status).toBe(403)

    signIn("owner")
    const role = await roleRoute.PATCH(req({ role: "ENTERPRISE_MANAGER", entityType: "ENTERPRISE", entityId: ENT }, "PATCH"), memberCtx("em_co"))
    expect(role.status).toBe(200)
    const del = await removeRoute.DELETE(req({ entityType: "ENTERPRISE", entityId: ENT }, "DELETE"), memberCtx("em_co"))
    expect(del.status).toBe(200)
  })

  it("the role helpers mirror the rule", () => {
    expect(canManageEnterpriseRole("ENTERPRISE_ADMIN", "ENTERPRISE_ADMIN", true)).toBe(true)
    expect(canManageEnterpriseRole("ENTERPRISE_ADMIN", "ENTERPRISE_ADMIN", false)).toBe(false)
    expect(canManageEnterpriseRole("ENTERPRISE_MANAGER", "ENTERPRISE_ADMIN", true)).toBe(false)
    expect(getAssignableEnterpriseRoles("ENTERPRISE_ADMIN", true)[0]).toBe("ENTERPRISE_ADMIN")
    expect(getAssignableEnterpriseRoles("USER", false)).toEqual([])
    expect(getAssignableEnterpriseRoles(null, true)).toEqual([])
  })
})

describe("pending enterprise invitations", () => {
  it("keeps an invitation to someone without an account", async () => {
    signIn("owner")
    const res = await invite({ email: "Newcomer@Test.local" })
    expect(res.status).toBe(201)
    expect((await res.json()).message).toBe("Invitation sent.")
    expect(invites.addEnterprisePendingInvite).toHaveBeenCalledWith(ENT, expect.objectContaining({ email: "newcomer@test.local", role: "VIEWER", invitedById: "owner" }))
  })

  it("lists them under status=pending with what the caller may do", async () => {
    prismaMock.enterprise.findFirst.mockResolvedValue({ ...ENTERPRISE, settings: { pendingInvites: [{ email: "pending@test.local", role: "VIEWER", invitedAt: "2026-11-01T00:00:00.000Z" }] } })
    signIn("owner")
    const json = await (await membersRoute.GET(get(`/api/admin/enterprise/${ENT}/members?status=pending`), entCtx)).json()
    expect(json.counts.pending).toBe(1)
    expect(json.data).toEqual([expect.objectContaining({ email: "pending@test.local", role: "VIEWER", canManage: true })])
  })

  it("cancels one with the same rank rule and audits it", async () => {
    signIn("viewer")
    expect((await cancelInviteRoute.DELETE(req({ email: "pending@test.local" }, "DELETE"), entCtx)).status).toBe(403)

    signIn("owner")
    expect((await cancelInviteRoute.DELETE(req({ email: "missing@test.local" }, "DELETE"), entCtx)).status).toBe(404)
    const ok = await cancelInviteRoute.DELETE(req({ email: "pending@test.local" }, "DELETE"), entCtx)
    expect(ok.status).toBe(200)
    expect(invites.removeEnterprisePendingInvite).toHaveBeenCalledWith(ENT, "pending@test.local")
  })
})

describe("bulk invite", () => {
  it("invites several addresses at once and reports each", async () => {
    signIn("owner")
    const res = await invite({ emails: ["known@test.local", "a@test.local", "A@test.local", "b@test.local"] })
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.data).toMatchObject({ added: 1, invited: 2, alreadyMembers: 0 })
    expect(json.message).toBe("1 added, 2 invited")
  })

  it("refuses a list with a bad address, naming it", async () => {
    signIn("owner")
    const res = await invite({ emails: ["ok@test.local", "not-an-email"] })
    expect(res.status).toBe(400)
    expect((await res.json()).message).toMatch(/address 2/)
    expect(invites.addEnterprisePendingInvite).not.toHaveBeenCalled()
  })
})

describe("removing", () => {
  it("answers 409 for a member who was already removed", async () => {
    signIn("owner")
    const res = await removeRoute.DELETE(req({ entityType: "ENTERPRISE", entityId: ENT }, "DELETE"), memberCtx("em_gone"))
    expect(res.status).toBe(409)
    expect(prismaMock.enterpriseMember.update).not.toHaveBeenCalled()
  })
})

describe("a banned account", () => {
  it("has no role anywhere, read on every check", async () => {
    expect(await getContextRole("banned", { enterpriseId: ENT })).toBeNull()
    expect(await getContextRole("banned")).toBeNull()
    expect((await authorize("banned", PERMISSIONS.MEMBER_VIEW, { enterpriseId: ENT })).authorized).toBe(false)
    signIn("banned")
    expect((await membersRoute.GET(get(`/api/admin/enterprise/${ENT}/members`), entCtx)).status).toBe(403)
  })
})
