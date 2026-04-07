import prisma from "@/lib/prisma"
import type { Role } from "@/lib/constants"
import {
  type Permission,
  getRolePermissions,
  hasPermission as checkPermission,
  hasAnyPermission as checkAnyPermission,
  ROLE_PERMISSIONS,
} from "@/lib/permissions"

interface AuthContext {
  enterpriseId?: string
  organizationId?: string
  eventId?: string
}

export async function getUserPermissions(
  userId: string,
  context?: AuthContext
): Promise<Permission[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, isActive: true },
  })

  if (!user || !user.isActive) return []

  // Super admin gets everything regardless of context
  if (user.role === "SUPER_ADMIN") {
    return ROLE_PERMISSIONS.SUPER_ADMIN
  }

  // If no context, return base role permissions
  if (!context?.enterpriseId && !context?.organizationId && !context?.eventId) {
    return getRolePermissions(user.role as Role)
  }

  // Check enterprise membership
  if (context.enterpriseId) {
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
      return getRolePermissions(membership.role as Role)
    }
  }

  // Check organization membership
  if (context.organizationId) {
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
      return getRolePermissions(orgMembership.role as Role)
    }

    // Check if user is enterprise admin of parent enterprise
    const org = await prisma.organization.findUnique({
      where: { id: context.organizationId },
      select: { enterpriseId: true },
    })

    if (org?.enterpriseId) {
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
        return getRolePermissions(entMembership.role as Role)
      }
    }
  }

  // Check event team membership
  if (context.eventId) {
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
      const mappedRole = roleMap[eventTeam.role] || "VIEWER"
      return getRolePermissions(mappedRole)
    }

    // Check org/enterprise membership via event
    const event = await prisma.event.findUnique({
      where: { id: context.eventId },
      select: { organizationId: true, enterpriseId: true },
    })

    if (event?.organizationId) {
      return getUserPermissions(userId, { organizationId: event.organizationId })
    }
    if (event?.enterpriseId) {
      return getUserPermissions(userId, { enterpriseId: event.enterpriseId })
    }
  }

  return []
}

export async function authorize(
  userId: string,
  permission: Permission | Permission[],
  context?: AuthContext
): Promise<{ authorized: boolean; message?: string }> {
  const permissions = await getUserPermissions(userId, context)

  if (permissions.length === 0) {
    return { authorized: false, message: "You don't have permission to perform this action." }
  }

  const required = Array.isArray(permission) ? permission : [permission]
  const authorized = checkAnyPermission(permissions, required)

  return {
    authorized,
    message: authorized ? undefined : "You don't have permission to perform this action.",
  }
}

export async function getUserEnterprises(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  })

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
        select: { id: true, name: true, slug: true, logo: true, isActive: true },
      },
    },
  })

  return memberships
    .filter((m) => m.enterprise.isActive)
    .map((m) => ({ ...m.enterprise, role: m.role }))
}

export async function getUserOrganizations(userId: string, enterpriseId?: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  })

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
        select: { id: true, name: true, slug: true, logo: true, enterpriseId: true, isActive: true },
      },
    },
  })

  return memberships
    .filter((m) => m.organization.isActive)
    .map((m) => ({ ...m.organization, role: m.role }))
}

export async function isEnterpriseMember(userId: string, enterpriseId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  })
  if (user?.role === "SUPER_ADMIN") return true

  const membership = await prisma.enterpriseMember.findUnique({
    where: { enterpriseId_userId: { enterpriseId, userId } },
    select: { isActive: true },
  })
  return !!membership?.isActive
}

export async function isOrganizationMember(userId: string, orgId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  })
  if (user?.role === "SUPER_ADMIN") return true

  const membership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId: orgId, userId } },
    select: { isActive: true },
  })
  if (membership?.isActive) return true

  // Check if enterprise admin/manager of parent enterprise
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { enterpriseId: true },
  })
  if (org?.enterpriseId) {
    return isEnterpriseMember(userId, org.enterpriseId)
  }

  return false
}

export async function isEventTeamMember(userId: string, eventId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  })
  if (user?.role === "SUPER_ADMIN") return true

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
    select: { role: true },
  })
  if (user?.role === "SUPER_ADMIN") return "SUPER_ADMIN"

  switch (entityType) {
    case "ENTERPRISE": {
      const m = await prisma.enterpriseMember.findUnique({
        where: { enterpriseId_userId: { enterpriseId: entityId, userId } },
        select: { role: true, isActive: true },
      })
      return m?.isActive ? (m.role as Role) : null
    }
    case "ORGANIZATION": {
      const m = await prisma.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId: entityId, userId } },
        select: { role: true, isActive: true },
      })
      return m?.isActive ? (m.role as Role) : null
    }
    case "EVENT": {
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
