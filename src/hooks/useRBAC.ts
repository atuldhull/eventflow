"use client"

import { useCallback, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useAuthStore } from "@/stores/useAuthStore"
import type { Permission } from "@/lib/permissions"
import {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  canManageRole,
  isAdminRole,
} from "@/lib/permissions"
import type { Role } from "@/lib/constants"

export function useRBAC() {
  const { data: session, status } = useSession()

  // Select individual fields rather than the whole store object: the store
  // snapshot changes identity on every write, which defeats the memoization
  // below and re-renders every consumer on unrelated state changes.
  const permissions = useAuthStore((s) => s.permissions)
  const currentEnterpriseId = useAuthStore((s) => s.currentEnterpriseId)
  const currentOrganizationId = useAuthStore((s) => s.currentOrganizationId)
  const accessibleEnterprises = useAuthStore((s) => s.accessibleEnterprises)
  const accessibleOrganizations = useAuthStore((s) => s.accessibleOrganizations)
  const isInitialized = useAuthStore((s) => s.isInitialized)
  const initialize = useAuthStore((s) => s.initialize)
  const setCurrentEnterprise = useAuthStore((s) => s.setCurrentEnterprise)
  const setCurrentOrganization = useAuthStore((s) => s.setCurrentOrganization)
  const enterpriseRole = useAuthStore((s) => s.enterpriseRole)
  const organizationRole = useAuthStore((s) => s.organizationRole)
  const isEnterpriseOwner = useAuthStore((s) => s.isEnterpriseOwner)

  // The GLOBAL role (User.role). Only the platform area means anything by it: inside an
  // enterprise or organization use enterpriseRole / organizationRole, the role held there.
  const role = (session?.user?.role || "USER") as Role
  const userId = session?.user?.id

  const fetchPermissions = useCallback(async () => {
    if (status !== "authenticated" || !userId) return

    const params = new URLSearchParams()
    if (currentEnterpriseId) params.set("enterpriseId", currentEnterpriseId)
    if (currentOrganizationId) params.set("organizationId", currentOrganizationId)

    try {
      const res = await fetch(`/api/auth/permissions?${params.toString()}`)
      const data = res.ok ? await res.json() : null

      // A failed lookup still finishes loading (with no access), so pages show their
      // "no access" state instead of an endless skeleton
      initialize({
        permissions: data?.permissions || [],
        enterprises: data?.accessibleEnterprises || [],
        organizations: data?.accessibleOrganizations || [],
        currentEnterpriseId,
        currentOrganizationId,
        enterpriseRole: data?.enterpriseRole ?? null,
        organizationRole: data?.organizationRole ?? null,
        isEnterpriseOwner: !!data?.isEnterpriseOwner,
      })
    } catch (error) {
      console.error("Failed to fetch permissions:", error)
      initialize({ permissions: [], enterprises: [], organizations: [], currentEnterpriseId, currentOrganizationId })
    }
  }, [status, userId, currentEnterpriseId, currentOrganizationId, initialize])

  useEffect(() => {
    if (status === "authenticated" && !isInitialized) {
      fetchPermissions()
    }
  }, [status, isInitialized, fetchPermissions])

  const setEnterpriseContext = useCallback(
    (enterpriseId: string | null) => {
      setCurrentEnterprise(enterpriseId)
      // Re-initialize to trigger permission refresh
      useAuthStore.setState({ isInitialized: false })
    },
    [setCurrentEnterprise]
  )

  const setOrganizationContext = useCallback(
    (orgId: string | null) => {
      setCurrentOrganization(orgId)
      useAuthStore.setState({ isInitialized: false })
    },
    [setCurrentOrganization]
  )

  return {
    user: session?.user || null,
    role,
    permissions,
    currentEnterpriseId,
    currentOrganizationId,
    accessibleEnterprises,
    accessibleOrganizations,
    /** the role held in the current enterprise (null: no access there) */
    enterpriseRole,
    /** the role held in the current organization, directly or through its enterprise */
    organizationRole,
    /** whether the user owns the current enterprise (may add co-admins, transfer ownership) */
    isEnterpriseOwner,
    isAdmin: isAdminRole(role),
    isSuperAdmin: role === "SUPER_ADMIN",
    isLoading: status === "loading" || !isInitialized,
    can: (permission: Permission) => hasPermission(permissions, permission),
    canAny: (perms: Permission[]) => hasAnyPermission(permissions, perms),
    canAll: (perms: Permission[]) => hasAllPermissions(permissions, perms),
    // rank checks use the role held in the current workspace, as the server does
    canManageRole: (targetRole: Role) => {
      const actor = role === "SUPER_ADMIN" ? role : (organizationRole ?? enterpriseRole)
      return !!actor && canManageRole(actor, targetRole)
    },
    setEnterpriseContext,
    setOrganizationContext,
    refreshPermissions: fetchPermissions,
  }
}
