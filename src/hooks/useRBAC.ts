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

  const role = (session?.user?.role || "USER") as Role
  const userId = session?.user?.id

  const fetchPermissions = useCallback(async () => {
    if (status !== "authenticated" || !userId) return

    try {
      const params = new URLSearchParams()
      if (currentEnterpriseId) params.set("enterpriseId", currentEnterpriseId)
      if (currentOrganizationId) params.set("organizationId", currentOrganizationId)

      const res = await fetch(`/api/auth/permissions?${params.toString()}`)
      if (!res.ok) return

      const data = await res.json()

      initialize({
        permissions: data.permissions || [],
        enterprises: data.accessibleEnterprises || [],
        organizations: data.accessibleOrganizations || [],
        currentEnterpriseId,
        currentOrganizationId,
      })
    } catch (error) {
      console.error("Failed to fetch permissions:", error)
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
    isAdmin: isAdminRole(role),
    isSuperAdmin: role === "SUPER_ADMIN",
    isLoading: status === "loading" || !isInitialized,
    can: (permission: Permission) => hasPermission(permissions, permission),
    canAny: (perms: Permission[]) => hasAnyPermission(permissions, perms),
    canAll: (perms: Permission[]) => hasAllPermissions(permissions, perms),
    canManageRole: (targetRole: Role) => canManageRole(role, targetRole),
    setEnterpriseContext,
    setOrganizationContext,
    refreshPermissions: fetchPermissions,
  }
}
