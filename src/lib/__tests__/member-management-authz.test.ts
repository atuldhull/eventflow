import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

// Member remove / role-change / invite authorization, run against the REAL authorize()
// with Prisma replaced by an in-memory fixture. The point: the caller's role is the one
// they hold in the target organization/enterprise, never their global User.role.
const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  organizationMember: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
  enterpriseMember: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
  eventTeamMember: { findUnique: vi.fn() },
  organization: { findUnique: vi.fn() },
  enterprise: { findUnique: vi.fn() },
  event: { findUnique: vi.fn() },
}))
const authMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/prisma", () => ({ default: prismaMock, prisma: prismaMock }))
vi.mock("@/lib/auth", () => ({ auth: authMock }))
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn() }))
vi.mock("@/lib/audit", () => ({
  createAuditLog: vi.fn(),
  getClientInfo: () => ({ ipAddress: "127.0.0.1", userAgent: "vitest" }),
}))
// pending invitations are stored in Organization.settings under a row lock (raw SQL)
vi.mock("@/lib/org-invites", () => ({ addPendingInvite: vi.fn(), removePendingInvite: vi.fn() }))

import * as removeRoute from "@/app/api/members/[memberId]/remove/route"
import * as roleRoute from "@/app/api/members/[memberId]/role/route"
import * as inviteRoute from "@/app/api/members/invite/route"

const ORG_X = "org_x" // standalone org
const ORG_Y = "org_y" // belongs to ENT_E
const ENT_E = "ent_e"
const ENT_OTHER = "ent_other"

// Global User.role per user. Several deliberately differ from the role they hold in ORG_X.
const USERS: Record<string, string> = {
  super: "SUPER_ADMIN",
  entAdminElsewhere: "ENTERPRISE_ADMIN", // ENTERPRISE_ADMIN of ENT_OTHER, only ORG_ADMIN in ORG_X
  adminElsewhereViewerHere: "ORG_ADMIN", // global ORG_ADMIN, only VIEWER in ORG_X
  userWithOrgAdmin: "USER", // global USER, ORG_ADMIN in ORG_X
  plain: "USER", // USER membership in ORG_X
  peerAdmin: "ORG_ADMIN",
  viewer: "USER",
  orgYViewer: "USER",
  owner: "ENTERPRISE_ADMIN",
  entAdmin: "ENTERPRISE_ADMIN",
  entViewer: "USER",
}

const ORG_MEMBERS = [
  { id: "om_ent_admin_elsewhere", organizationId: ORG_X, userId: "entAdminElsewhere", role: "ORG_ADMIN", isActive: true },
  { id: "om_viewer_here", organizationId: ORG_X, userId: "adminElsewhereViewerHere", role: "VIEWER", isActive: true },
  { id: "om_user_org_admin", organizationId: ORG_X, userId: "userWithOrgAdmin", role: "ORG_ADMIN", isActive: true },
  { id: "om_plain", organizationId: ORG_X, userId: "plain", role: "USER", isActive: true },
  { id: "om_peer", organizationId: ORG_X, userId: "peerAdmin", role: "ORG_ADMIN", isActive: true },
  { id: "om_viewer", organizationId: ORG_X, userId: "viewer", role: "VIEWER", isActive: true },
  { id: "om_y_viewer", organizationId: ORG_Y, userId: "orgYViewer", role: "VIEWER", isActive: true },
]
const ENT_MEMBERS = [
  // The owner's membership role is below ENTERPRISE_ADMIN, so only the owner rule protects it.
  { id: "em_owner", enterpriseId: ENT_E, userId: "owner", role: "ENTERPRISE_MANAGER", isActive: true },
  { id: "em_admin", enterpriseId: ENT_E, userId: "entAdmin", role: "ENTERPRISE_ADMIN", isActive: true },
  { id: "em_viewer", enterpriseId: ENT_E, userId: "entViewer", role: "VIEWER", isActive: true },
  { id: "em_other_admin", enterpriseId: ENT_OTHER, userId: "entAdminElsewhere", role: "ENTERPRISE_ADMIN", isActive: true },
]
// all live (active, not deleted): authorize() denies a deactivated or deleted workspace
const LIVE = { isActive: true, deletedAt: null }
const ENTERPRISES: Record<string, { ownerId: string; name: string; isActive: boolean; deletedAt: null }> = {
  [ENT_E]: { ownerId: "owner", name: "Ent E", ...LIVE },
  [ENT_OTHER]: { ownerId: "entAdminElsewhere", name: "Ent Other", ...LIVE },
}
const ORGS: Record<string, { enterpriseId: string | null; name: string; isActive: boolean; deletedAt: null; enterprise: unknown }> = {
  [ORG_X]: { enterpriseId: null, name: "Org X", ...LIVE, enterprise: null },
  [ORG_Y]: { enterpriseId: ENT_E, name: "Org Y", ...LIVE, enterprise: ENTERPRISES[ENT_E] },
}

type Where = Record<string, unknown>
const matches = (where: Where, row: Record<string, unknown>) => Object.entries(where).every(([k, v]) => row[k] === v)

function req(body: unknown) {
  return new NextRequest("http://localhost/x", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  })
}
const ctx = (memberId: string) => ({ params: Promise.resolve({ memberId }) })

function signIn(userId: string) {
  authMock.mockResolvedValue({ user: { id: userId, role: USERS[userId], name: "Test" } })
}

const remove = (memberId: string, entityType: string, entityId: string) =>
  removeRoute.DELETE(req({ entityType, entityId }), ctx(memberId))
const changeRole = (memberId: string, role: string, entityType: string, entityId: string) =>
  roleRoute.PATCH(req({ role, entityType, entityId }), ctx(memberId))

beforeEach(() => {
  vi.resetAllMocks()

  prismaMock.user.findUnique.mockImplementation(async ({ where }: { where: { id?: string; email?: string } }) =>
    where.id && USERS[where.id] ? { role: USERS[where.id], isActive: true } : null
  )
  prismaMock.organizationMember.findUnique.mockImplementation(
    async ({ where }: { where: { organizationId_userId: { organizationId: string; userId: string } } }) =>
      ORG_MEMBERS.find((m) => matches(where.organizationId_userId, m)) ?? null
  )
  prismaMock.enterpriseMember.findUnique.mockImplementation(
    async ({ where }: { where: { enterpriseId_userId: { enterpriseId: string; userId: string } } }) =>
      ENT_MEMBERS.find((m) => matches(where.enterpriseId_userId, m)) ?? null
  )
  prismaMock.organizationMember.findFirst.mockImplementation(async ({ where }: { where: Where }) => ORG_MEMBERS.find((m) => matches(where, m)) ?? null)
  prismaMock.enterpriseMember.findFirst.mockImplementation(async ({ where }: { where: Where }) => ENT_MEMBERS.find((m) => matches(where, m)) ?? null)
  prismaMock.organization.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => ORGS[where.id] ?? null)
  prismaMock.enterprise.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => ENTERPRISES[where.id] ?? null)
  prismaMock.eventTeamMember.findUnique.mockResolvedValue(null)
  prismaMock.event.findUnique.mockResolvedValue(null)
})

describe("member management requires the permission in THAT org/enterprise", () => {
  it("denies a user who is an admin elsewhere but only a VIEWER here", async () => {
    signIn("adminElsewhereViewerHere")

    expect((await remove("om_viewer", "ORGANIZATION", ORG_X)).status).toBe(403)
    expect((await changeRole("om_viewer", "COORDINATOR", "ORGANIZATION", ORG_X)).status).toBe(403)
    expect(prismaMock.organizationMember.update).not.toHaveBeenCalled()
  })

  it("denies a plain USER membership", async () => {
    signIn("plain")

    expect((await remove("om_viewer", "ORGANIZATION", ORG_X)).status).toBe(403)
    expect((await changeRole("om_viewer", "COORDINATOR", "ORGANIZATION", ORG_X)).status).toBe(403)
    expect(prismaMock.organizationMember.update).not.toHaveBeenCalled()
  })

  it("denies an org admin acting on an org they don't belong to", async () => {
    signIn("userWithOrgAdmin")

    expect((await remove("om_y_viewer", "ORGANIZATION", ORG_Y)).status).toBe(403)
    expect(prismaMock.organizationMember.update).not.toHaveBeenCalled()
  })
})

describe("the role hierarchy uses the caller's role in that entity, not their global role", () => {
  it("stops a global ENTERPRISE_ADMIN who is only ORG_ADMIN here from touching a peer ORG_ADMIN", async () => {
    signIn("entAdminElsewhere")

    expect((await remove("om_peer", "ORGANIZATION", ORG_X)).status).toBe(403)
    expect((await changeRole("om_peer", "VIEWER", "ORGANIZATION", ORG_X)).status).toBe(403)
    expect(prismaMock.organizationMember.update).not.toHaveBeenCalled()
  })

  it("stops them granting a role equal to or above their role here", async () => {
    signIn("entAdminElsewhere")

    expect((await changeRole("om_viewer", "ORG_ADMIN", "ORGANIZATION", ORG_X)).status).toBe(403)
    expect((await changeRole("om_viewer", "ENTERPRISE_MANAGER", "ORGANIZATION", ORG_X)).status).toBe(403)
    expect(prismaMock.organizationMember.update).not.toHaveBeenCalled()

    const ok = await changeRole("om_viewer", "COORDINATOR", "ORGANIZATION", ORG_X)
    expect(ok.status).toBe(200)
    expect(prismaMock.organizationMember.update).toHaveBeenCalledWith({ where: { id: "om_viewer" }, data: { role: "COORDINATOR" } })
  })

  it("lets an ORG_ADMIN member whose global role is USER manage lower members", async () => {
    signIn("userWithOrgAdmin")

    const role = await changeRole("om_viewer", "COORDINATOR", "ORGANIZATION", ORG_X)
    const del = await remove("om_viewer", "ORGANIZATION", ORG_X)

    expect(role.status).toBe(200)
    expect(del.status).toBe(200)
    expect(prismaMock.organizationMember.update).toHaveBeenCalledWith({ where: { id: "om_viewer" }, data: { isActive: false } })
  })

  it("lets the parent enterprise's admin manage that enterprise's org members", async () => {
    signIn("entAdmin")

    const res = await changeRole("om_y_viewer", "COORDINATOR", "ORGANIZATION", ORG_Y)

    expect(res.status).toBe(200)
  })

  it("keeps SUPER_ADMIN access without any membership", async () => {
    signIn("super")

    const role = await changeRole("om_peer", "VIEWER", "ORGANIZATION", ORG_X)
    const del = await remove("om_viewer", "ORGANIZATION", ORG_X)

    expect(role.status).toBe(200)
    expect(del.status).toBe(200)
  })

  it("still refuses self-removal and self role change", async () => {
    signIn("userWithOrgAdmin")

    expect((await remove("om_user_org_admin", "ORGANIZATION", ORG_X)).status).toBe(400)
    expect((await changeRole("om_user_org_admin", "VIEWER", "ORGANIZATION", ORG_X)).status).toBe(400)
  })
})

describe("the enterprise owner is protected", () => {
  it("cannot be removed or re-roled by an enterprise admin, or by SUPER_ADMIN", async () => {
    signIn("entAdmin")
    expect((await remove("em_owner", "ENTERPRISE", ENT_E)).status).toBe(403)
    expect((await changeRole("em_owner", "VIEWER", "ENTERPRISE", ENT_E)).status).toBe(403)

    signIn("super")
    expect((await remove("em_owner", "ENTERPRISE", ENT_E)).status).toBe(403)
    expect((await changeRole("em_owner", "VIEWER", "ENTERPRISE", ENT_E)).status).toBe(403)

    expect(prismaMock.enterpriseMember.update).not.toHaveBeenCalled()
  })

  it("does not block managing other enterprise members", async () => {
    signIn("entAdmin")

    const res = await remove("em_viewer", "ENTERPRISE", ENT_E)

    expect(res.status).toBe(200)
    expect(prismaMock.enterpriseMember.update).toHaveBeenCalledWith({ where: { id: "em_viewer" }, data: { isActive: false } })
  })
})

describe("invite uses the caller's role in that entity for the hierarchy", () => {
  const invite = (role: string) =>
    inviteRoute.POST(req({ email: "new@test.local", role, entityType: "ORGANIZATION", entityId: ORG_X }))

  it("refuses a role at or above the caller's role there, even with a higher global role", async () => {
    signIn("entAdminElsewhere")

    expect((await invite("ORG_ADMIN")).status).toBe(403)
    expect((await invite("ENTERPRISE_MANAGER")).status).toBe(403)
    expect((await invite("COORDINATOR")).status).toBe(201)
  })

  it("denies a member without invite permission there", async () => {
    signIn("adminElsewhereViewerHere")

    expect((await invite("COORDINATOR")).status).toBe(403)
  })
})
