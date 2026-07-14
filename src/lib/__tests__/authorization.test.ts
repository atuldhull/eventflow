import { describe, it, expect, beforeEach, vi } from "vitest"

// The RBAC layer reads memberships through Prisma. These tests stub the client with a
// small in-memory fixture so the decision logic is exercised without a database.
const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  organizationMember: { findUnique: vi.fn() },
  enterpriseMember: { findUnique: vi.fn() },
  eventTeamMember: { findUnique: vi.fn() },
  organization: { findUnique: vi.fn(), findFirst: vi.fn() },
  event: { findUnique: vi.fn(), findFirst: vi.fn() },
}))

vi.mock("@/lib/prisma", () => ({
  default: prismaMock,
  prisma: prismaMock,
}))

import { authorize, getUserPermissions, isOrganizationMember } from "@/lib/authorization"
import {
  PERMISSIONS,
  getRolePermissions,
  hasPermission,
  hasAnyPermission,
  canManageRole,
} from "@/lib/permissions"
import { getTenantEventFilter, verifyEntityBelongsToTenant } from "@/lib/tenant-scope"
import type { TenantContext } from "@/lib/tenant"

const USER_ID = "user_1"
const ORG_A = "org_a"
const ORG_B = "org_b"
const ENTERPRISE_A = "ent_a"
const EVENT_IN_A = "event_a"
const EVENT_IN_B = "event_b"

const EVENTS = [
  { id: EVENT_IN_A, organizationId: ORG_A, enterpriseId: null },
  { id: EVENT_IN_B, organizationId: ORG_B, enterpriseId: null },
]

type MembershipArgs = { where: { organizationId_userId: { organizationId: string; userId: string } } }
type EventArgs = { where: { id: string; organizationId?: string } }
type OrgArgs = { where: { id: string; enterpriseId?: string } }

// user_1 is an ORG_ADMIN of org_a and has no relationship to org_b.
function seedOrgAdminOfOrgA({ isActive = true } = {}) {
  prismaMock.user.findUnique.mockResolvedValue({ role: "ORG_ADMIN", isActive: true })

  prismaMock.organizationMember.findUnique.mockImplementation(({ where }: MembershipArgs) => {
    const { organizationId, userId } = where.organizationId_userId
    if (organizationId === ORG_A && userId === USER_ID) {
      return Promise.resolve({ role: "ORG_ADMIN", isActive })
    }
    return Promise.resolve(null)
  })

  // Neither org belongs to an enterprise, so there is no inherited access path.
  prismaMock.organization.findUnique.mockResolvedValue({ enterpriseId: null })
  prismaMock.enterpriseMember.findUnique.mockResolvedValue(null)
  prismaMock.eventTeamMember.findUnique.mockResolvedValue(null)
  prismaMock.event.findUnique.mockImplementation(({ where }: EventArgs) =>
    Promise.resolve(EVENTS.find((e) => e.id === where.id) ?? null)
  )
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe("tenant isolation: a role in org A grants nothing in org B", () => {
  it("authorizes an org member against their own organization", async () => {
    seedOrgAdminOfOrgA()

    const result = await authorize(USER_ID, PERMISSIONS.ORG_EDIT, { organizationId: ORG_A })

    expect(result.authorized).toBe(true)
  })

  it("denies the same user against another organization", async () => {
    seedOrgAdminOfOrgA()

    const result = await authorize(USER_ID, PERMISSIONS.ORG_EDIT, { organizationId: ORG_B })

    expect(result.authorized).toBe(false)
    expect(result.message).toBeTruthy()
  })

  it("resolves zero permissions in an organization the user does not belong to", async () => {
    seedOrgAdminOfOrgA()

    const permissions = await getUserPermissions(USER_ID, { organizationId: ORG_B })

    expect(permissions).toEqual([])
  })

  it("does not leak the caller's global role into another tenant's context", async () => {
    // The user's global User.role is ORG_ADMIN. That must not, on its own, grant
    // ORG_ADMIN permissions inside an organization they are not a member of.
    seedOrgAdminOfOrgA()

    const result = await authorize(USER_ID, PERMISSIONS.REGISTRATION_EXPORT, { organizationId: ORG_B })

    expect(result.authorized).toBe(false)
  })

  it("denies access to an event owned by another organization", async () => {
    seedOrgAdminOfOrgA()

    const allowed = await authorize(USER_ID, PERMISSIONS.EVENT_EDIT, { eventId: EVENT_IN_A })
    const denied = await authorize(USER_ID, PERMISSIONS.EVENT_EDIT, { eventId: EVENT_IN_B })

    expect(allowed.authorized).toBe(true)
    expect(denied.authorized).toBe(false)
  })

  it("denies a member whose membership has been deactivated", async () => {
    seedOrgAdminOfOrgA({ isActive: false })

    const result = await authorize(USER_ID, PERMISSIONS.ORG_EDIT, { organizationId: ORG_A })

    expect(result.authorized).toBe(false)
  })

  it("denies a user whose account is inactive", async () => {
    seedOrgAdminOfOrgA()
    prismaMock.user.findUnique.mockResolvedValue({ role: "ORG_ADMIN", isActive: false })

    const result = await authorize(USER_ID, PERMISSIONS.ORG_EDIT, { organizationId: ORG_A })

    expect(result.authorized).toBe(false)
  })

  it("reports organization membership per organization", async () => {
    seedOrgAdminOfOrgA()

    await expect(isOrganizationMember(USER_ID, ORG_A)).resolves.toBe(true)
    await expect(isOrganizationMember(USER_ID, ORG_B)).resolves.toBe(false)
  })

  it("lets a SUPER_ADMIN cross tenant boundaries", async () => {
    seedOrgAdminOfOrgA()
    prismaMock.user.findUnique.mockResolvedValue({ role: "SUPER_ADMIN", isActive: true })

    const result = await authorize(USER_ID, PERMISSIONS.ORG_EDIT, { organizationId: ORG_B })

    expect(result.authorized).toBe(true)
  })
})

describe("role permissions", () => {
  it("gives ORG_ADMIN destructive event permissions", () => {
    const perms = getRolePermissions("ORG_ADMIN")

    expect(hasPermission(perms, PERMISSIONS.EVENT_DELETE)).toBe(true)
    expect(hasPermission(perms, PERMISSIONS.MEMBER_REMOVE)).toBe(true)
  })

  it("limits COORDINATOR to day-of operations", () => {
    const perms = getRolePermissions("COORDINATOR")

    expect(hasPermission(perms, PERMISSIONS.CHECKIN_PERFORM)).toBe(true)
    expect(hasPermission(perms, PERMISSIONS.EVENT_DELETE)).toBe(false)
    expect(hasPermission(perms, PERMISSIONS.PAYMENT_REFUND)).toBe(false)
  })

  it("keeps VIEWER read-only", () => {
    const perms = getRolePermissions("VIEWER")

    expect(hasPermission(perms, PERMISSIONS.EVENT_VIEW)).toBe(true)
    expect(hasPermission(perms, PERMISSIONS.EVENT_EDIT)).toBe(false)
    expect(hasPermission(perms, PERMISSIONS.CHECKIN_PERFORM)).toBe(false)
  })

  it("scopes FINANCE_MANAGER to money, not membership", () => {
    const perms = getRolePermissions("FINANCE_MANAGER")

    expect(hasPermission(perms, PERMISSIONS.PAYMENT_REFUND)).toBe(true)
    expect(hasPermission(perms, PERMISSIONS.MEMBER_INVITE)).toBe(false)
    expect(hasPermission(perms, PERMISSIONS.EVENT_DELETE)).toBe(false)
  })

  it("gives a plain USER no admin permissions at all", () => {
    expect(getRolePermissions("USER")).toEqual([])
  })

  it("gives SUPER_ADMIN the platform permissions", () => {
    const perms = getRolePermissions("SUPER_ADMIN")

    expect(hasPermission(perms, PERMISSIONS.PLATFORM_IMPERSONATE)).toBe(true)
    expect(hasPermission(perms, PERMISSIONS.PLATFORM_MANAGE_USERS)).toBe(true)
  })

  it("requires only one of the permissions in an any-check", () => {
    const perms = getRolePermissions("COORDINATOR")

    expect(hasAnyPermission(perms, [PERMISSIONS.EVENT_DELETE, PERMISSIONS.CHECKIN_PERFORM])).toBe(true)
    expect(hasAnyPermission(perms, [PERMISSIONS.EVENT_DELETE, PERMISSIONS.PAYMENT_REFUND])).toBe(false)
  })

  it("only lets a role manage strictly lower roles", () => {
    expect(canManageRole("ORG_ADMIN", "EVENT_MANAGER")).toBe(true)
    expect(canManageRole("ORG_ADMIN", "ENTERPRISE_ADMIN")).toBe(false)
    expect(canManageRole("EVENT_MANAGER", "ORG_ADMIN")).toBe(false)
    expect(canManageRole("COORDINATOR", "FINANCE_MANAGER")).toBe(false)
    expect(canManageRole("ORG_ADMIN", "ORG_ADMIN")).toBe(false)
  })
})

describe("tenant scope helpers", () => {
  const orgTenant: TenantContext = {
    type: "organization",
    id: ORG_A,
    slug: "org-a",
    name: "Org A",
    logo: null,
    primaryColor: "#000000",
    secondaryColor: "#ffffff",
    customDomain: null,
    subdomain: "org-a",
    isWhiteLabel: false,
  }

  const enterpriseTenant: TenantContext = { ...orgTenant, type: "enterprise", id: ENTERPRISE_A, slug: "ent-a", name: "Ent A" }

  it("scopes the event filter to the organization tenant", () => {
    expect(getTenantEventFilter(orgTenant)).toEqual({ deletedAt: null, organizationId: ORG_A })
  })

  it("scopes the event filter to the enterprise and its organizations", () => {
    expect(getTenantEventFilter(enterpriseTenant)).toEqual({
      deletedAt: null,
      OR: [{ enterpriseId: ENTERPRISE_A }, { organization: { enterpriseId: ENTERPRISE_A } }],
    })
  })

  it("falls back to a non-deleted filter with no tenant", () => {
    expect(getTenantEventFilter(null)).toEqual({ deletedAt: null })
  })

  it("rejects an event belonging to a different organizationId", async () => {
    prismaMock.event.findFirst.mockImplementation(({ where }: EventArgs) =>
      Promise.resolve(
        EVENTS.find((e) => e.id === where.id && e.organizationId === where.organizationId) ?? null
      )
    )

    await expect(verifyEntityBelongsToTenant("event", EVENT_IN_A, orgTenant)).resolves.toBe(true)
    await expect(verifyEntityBelongsToTenant("event", EVENT_IN_B, orgTenant)).resolves.toBe(false)

    // The tenant id must actually reach the query, not just the entity id.
    expect(prismaMock.event.findFirst).toHaveBeenLastCalledWith({
      where: { id: EVENT_IN_B, deletedAt: null, organizationId: ORG_A },
    })
  })

  it("rejects an organization outside the enterprise tenant", async () => {
    prismaMock.organization.findFirst.mockImplementation(({ where }: OrgArgs) =>
      Promise.resolve(where.id === ORG_A && where.enterpriseId === ENTERPRISE_A ? { id: ORG_A } : null)
    )

    await expect(verifyEntityBelongsToTenant("organization", ORG_A, enterpriseTenant)).resolves.toBe(true)
    await expect(verifyEntityBelongsToTenant("organization", ORG_B, enterpriseTenant)).resolves.toBe(false)
  })

  it("never treats an organization tenant as owning another organization", async () => {
    await expect(verifyEntityBelongsToTenant("organization", ORG_B, orgTenant)).resolves.toBe(false)
    expect(prismaMock.organization.findFirst).not.toHaveBeenCalled()
  })
})
