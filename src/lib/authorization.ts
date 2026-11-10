import prisma from "@/lib/prisma"
import type { Role } from "@/lib/constants"
import {
  type Permission,
  getRolePermissions,
  hasPermission as checkPermission,
  hasAnyPermission as checkAnyPermission,
} from "@/lib/permissions"

interface AuthContext {
  enterpriseId?: string
  organizationId?: string
  eventId?: string
}

const ACCOUNT_SELECT = { role: true, isActive: true, isBanned: true, deletedAt: true } as const

/** A deactivated, banned or deleted account: it gets no workspace, membership or role. */
function isLockedOut(user: { isActive?: boolean; isBanned?: boolean; deletedAt?: Date | null } | null): boolean {
  return !!user && (user.isActive === false || user.isBanned === true || !!user.deletedAt)
}

type Liveness = { isActive: boolean; deletedAt: Date | null } | null | undefined

/** An enterprise or organization that is active and not soft-deleted. */
function isLive(entity: Liveness): boolean {
  return !!entity && entity.isActive === true && !entity.deletedAt
}

async function isEnterpriseLive(enterpriseId: string): Promise<boolean> {
  const enterprise = await prisma.enterprise.findUnique({
    where: { id: enterpriseId },
    select: { isActive: true, deletedAt: true },
  })
  return isLive(enterprise)
}

/**
 * The organization when it, and the enterprise it belongs to (if any), are active and not
 * deleted; otherwise null. A deactivated or deleted workspace grants nothing to its
 * members, so former members can't keep using its API by id.
 */
async function liveOrganization(organizationId: string): Promise<{ enterpriseId: string | null } | null> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { isActive: true, deletedAt: true, enterpriseId: true, enterprise: { select: { isActive: true, deletedAt: true } } },
  })
  if (!org || !isLive(org)) return null
  if (org.enterpriseId && !isLive(org.enterprise)) return null
  return { enterpriseId: org.enterpriseId }
}

/**
 * The role whose permissions apply to `userId` in `context`, or null when they have none
 * there. SUPER_ADMIN is returned in any context; with no context it is the global
 * User.role. Inside a context it is the membership role (org membership first, then the
 * parent enterprise's), never the global role, so any role comparison made for a
 * context (e.g. canManageRole) must use this rather than `session.user.role`.
 *
 * A context whose enterprise or organization is deactivated or soft-deleted (or whose
 * event belongs to one) yields null for everyone but SUPER_ADMIN.
 *
 * A deactivated, banned or deleted account has no role anywhere, read from the database
 * on every call, so a ban takes effect on the next request (not when the JWT refreshes).
 */
export async function getContextRole(
  userId: string,
  context?: AuthContext
): Promise<Role | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, isActive: true, isBanned: true, deletedAt: true },
  })

  if (!user || !user.isActive || user.isBanned || user.deletedAt) return null

  // Super admin gets everything regardless of context
  if (user.role === "SUPER_ADMIN") {
    return "SUPER_ADMIN"
  }

  // If no context, return base role
  if (!context?.enterpriseId && !context?.organizationId && !context?.eventId) {
    return user.role as Role
  }

  // Check enterprise membership
  if (context.enterpriseId) {
    if (!(await isEnterpriseLive(context.enterpriseId))) return null

    const membership = await prisma.enterpriseMember.findUnique({
      where: {
        enterpriseId_userId: {
          enterpriseId: context.enterpriseId,
          userId,
        },
      },
      select: { role: true, isActive: true },
    })

    if (membership && membership.isActive) {
      return membership.role as Role
    }
  }

  // Check organization membership
  if (context.organizationId) {
    const org = await liveOrganization(context.organizationId)
    if (!org) return null

    const orgMembership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: context.organizationId,
          userId,
        },
      },
      select: { role: true, isActive: true },
    })

    if (orgMembership && orgMembership.isActive) {
      return orgMembership.role as Role
    }

    // Check if user is enterprise admin of parent enterprise
    if (org.enterpriseId) {
      const entMembership = await prisma.enterpriseMember.findUnique({
        where: {
          enterpriseId_userId: {
            enterpriseId: org.enterpriseId,
            userId,
          },
        },
        select: { role: true, isActive: true },
      })

      if (entMembership && entMembership.isActive) {
        return entMembership.role as Role
      }
    }
  }

  // Check event team membership
  if (context.eventId) {
    const event = await prisma.event.findUnique({
      where: { id: context.eventId },
      select: { organizationId: true, enterpriseId: true },
    })
    if (!event) return null
    // An event of a deactivated or deleted organization or enterprise grants nothing,
    // event team roles included
    if (event.organizationId && !(await liveOrganization(event.organizationId))) return null
    if (event.enterpriseId && !(await isEnterpriseLive(event.enterpriseId))) return null

    const eventTeam = await prisma.eventTeamMember.findUnique({
      where: {
        eventId_userId: {
          eventId: context.eventId,
          userId,
        },
      },
      select: { role: true, isActive: true },
    })

    if (eventTeam && eventTeam.isActive) {
      // Map event team roles to permission roles
      const roleMap: Record<string, Role> = {
        MANAGER: "EVENT_MANAGER",
        COORDINATOR: "COORDINATOR",
        VOLUNTEER: "COORDINATOR",
        SCANNER: "COORDINATOR",
        SUPPORT: "VIEWER",
      }
      return roleMap[eventTeam.role] || "VIEWER"
    }

    // Check org/enterprise membership via event
    if (event.organizationId) {
      return getContextRole(userId, { organizationId: event.organizationId })
    }
    if (event.enterpriseId) {
      return getContextRole(userId, { enterpriseId: event.enterpriseId })
    }
  }

  return null
}

export async function getUserPermissions(
  userId: string,
  context?: AuthContext
): Promise<Permission[]> {
  const role = await getContextRole(userId, context)
  return role ? getRolePermissions(role) : []
}

/**
 * Checks `permission` in `context`. When authorized, `role` is the caller's role in that
 * context (the one whose permissions were checked), for role-hierarchy decisions.
 */
export async function authorize(
  userId: string,
  permission: Permission | Permission[],
  context?: AuthContext
): Promise<{ authorized: boolean; message?: string; role?: Role }> {
  const role = await getContextRole(userId, context)
  const permissions = role ? getRolePermissions(role) : []

  if (!role || permissions.length === 0) {
    return { authorized: false, message: "You don't have permission to perform this action." }
  }

  const required = Array.isArray(permission) ? permission : [permission]
  const authorized = checkAnyPermission(permissions, required)

  return authorized
    ? { authorized, role }
    : { authorized, message: "You don't have permission to perform this action." }
}

/** The event exists and its organization and enterprise (whichever it has) are live. */
async function isEventWorkspaceLive(eventId: string): Promise<boolean> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { organizationId: true, enterpriseId: true },
  })
  if (!event) return false
  if (event.organizationId && !(await liveOrganization(event.organizationId))) return false
  if (event.enterpriseId && !(await isEnterpriseLive(event.enterpriseId))) return false
  return true
}

/** Enterprise.ownerId is the only owner concept (organizations have none). */
export async function isEnterpriseOwner(enterpriseId: string, userId: string): Promise<boolean> {
  const enterprise = await prisma.enterprise.findUnique({
    where: { id: enterpriseId },
    select: { ownerId: true },
  })
  return enterprise?.ownerId === userId
}

export async function getUserEnterprises(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: ACCOUNT_SELECT,
  })
  if (isLockedOut(user)) return []

  if (user?.role === "SUPER_ADMIN") {
    return prisma.enterprise.findMany({
      where: { isActive: true, deletedAt: null },
      select: { id: true, name: true, slug: true, logo: true },
      orderBy: { name: "asc" },
    })
  }

  const memberships = await prisma.enterpriseMember.findMany({
    where: { userId, isActive: true },
    include: {
      enterprise: {
        select: { id: true, name: true, slug: true, logo: true, isActive: true, deletedAt: true },
      },
    },
  })

  return memberships
    .filter((m) => m.enterprise.isActive && !m.enterprise.deletedAt)
    .map((m) => ({ ...m.enterprise, role: m.role }))
}

export async function getUserOrganizations(userId: string, enterpriseId?: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: ACCOUNT_SELECT,
  })
  if (isLockedOut(user)) return []

  if (user?.role === "SUPER_ADMIN") {
    return prisma.organization.findMany({
      where: { isActive: true, deletedAt: null, ...(enterpriseId ? { enterpriseId } : {}) },
      select: { id: true, name: true, slug: true, logo: true, enterpriseId: true },
      orderBy: { name: "asc" },
    })
  }

  // Check enterprise memberships (enterprise admins/managers see all orgs)
  if (enterpriseId) {
    const entMembership = await prisma.enterpriseMember.findUnique({
      where: { enterpriseId_userId: { enterpriseId, userId } },
      select: { role: true, isActive: true },
    })

    if (entMembership?.isActive && ["ENTERPRISE_ADMIN", "ENTERPRISE_MANAGER"].includes(entMembership.role)) {
      return prisma.organization.findMany({
        where: { enterpriseId, isActive: true, deletedAt: null },
        select: { id: true, name: true, slug: true, logo: true, enterpriseId: true },
        orderBy: { name: "asc" },
      })
    }
  }

  const memberships = await prisma.organizationMember.findMany({
    where: { userId, isActive: true },
    include: {
      organization: {
        select: { id: true, name: true, slug: true, logo: true, enterpriseId: true, isActive: true, deletedAt: true },
      },
    },
  })

  return memberships
    .filter((m) => m.organization.isActive && !m.organization.deletedAt)
    .map((m) => ({ ...m.organization, role: m.role }))
}

export async function isEnterpriseMember(userId: string, enterpriseId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: ACCOUNT_SELECT,
  })
  if (isLockedOut(user)) return false
  if (user?.role === "SUPER_ADMIN") return true
  if (!(await isEnterpriseLive(enterpriseId))) return false

  const membership = await prisma.enterpriseMember.findUnique({
    where: { enterpriseId_userId: { enterpriseId, userId } },
    select: { isActive: true },
  })
  return !!membership?.isActive
}

export async function isOrganizationMember(userId: string, orgId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: ACCOUNT_SELECT,
  })
  if (isLockedOut(user)) return false
  if (user?.role === "SUPER_ADMIN") return true
  const org = await liveOrganization(orgId)
  if (!org) return false

  const membership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId: orgId, userId } },
    select: { isActive: true },
  })
  if (membership?.isActive) return true

  // Check if enterprise admin/manager of parent enterprise
  if (org.enterpriseId) {
    return isEnterpriseMember(userId, org.enterpriseId)
  }

  return false
}

export async function isEventTeamMember(userId: string, eventId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: ACCOUNT_SELECT,
  })
  if (isLockedOut(user)) return false
  if (user?.role === "SUPER_ADMIN") return true
  if (!(await isEventWorkspaceLive(eventId))) return false

  const membership = await prisma.eventTeamMember.findUnique({
    where: { eventId_userId: { eventId, userId } },
    select: { isActive: true },
  })
  if (membership?.isActive) return true

  // Check org/enterprise membership
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { organizationId: true, enterpriseId: true },
  })
  if (event?.organizationId) return isOrganizationMember(userId, event.organizationId)
  if (event?.enterpriseId) return isEnterpriseMember(userId, event.enterpriseId)

  return false
}

export async function getEntityRole(
  userId: string,
  entityType: "ENTERPRISE" | "ORGANIZATION" | "EVENT",
  entityId: string
): Promise<Role | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: ACCOUNT_SELECT,
  })
  if (isLockedOut(user)) return null
  if (user?.role === "SUPER_ADMIN") return "SUPER_ADMIN"

  switch (entityType) {
    case "ENTERPRISE": {
      if (!(await isEnterpriseLive(entityId))) return null
      const m = await prisma.enterpriseMember.findUnique({
        where: { enterpriseId_userId: { enterpriseId: entityId, userId } },
        select: { role: true, isActive: true },
      })
      return m?.isActive ? (m.role as Role) : null
    }
    case "ORGANIZATION": {
      if (!(await liveOrganization(entityId))) return null
      const m = await prisma.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId: entityId, userId } },
        select: { role: true, isActive: true },
      })
      return m?.isActive ? (m.role as Role) : null
    }
    case "EVENT": {
      if (!(await isEventWorkspaceLive(entityId))) return null
      const m = await prisma.eventTeamMember.findUnique({
        where: { eventId_userId: { eventId: entityId, userId } },
        select: { role: true, isActive: true },
      })
      if (m?.isActive) {
        const roleMap: Record<string, Role> = {
          MANAGER: "EVENT_MANAGER",
          COORDINATOR: "COORDINATOR",
          VOLUNTEER: "COORDINATOR",
          SCANNER: "COORDINATOR",
          SUPPORT: "VIEWER",
        }
        return roleMap[m.role] || "VIEWER"
      }
      return null
    }
    default:
      return null
  }
}
