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
  const store = useAuthStore()

  const role = (session?.user?.role || "USER") as Role

  const fetchPermissions = useCallback(async () => {
    if (status !== "authenticated" || !session?.user?.id) return

    try {
      const params = new URLSearchParams()
      if (store.currentEnterpriseId) params.set("enterpriseId", store.currentEnterpriseId)
      if (store.currentOrganizationId) params.set("organizationId", store.currentOrganizationId)

      const res = await fetch(`/api/auth/permissions?${params.toString()}`)
      if (!res.ok) return

      const data = await res.json()

      store.initialize({
        permissions: data.permissions || [],
        enterprises: data.accessibleEnterprises || [],
        organizations: data.accessibleOrganizations || [],
        currentEnterpriseId: store.currentEnterpriseId,
        currentOrganizationId: store.currentOrganizationId,
      })
    } catch (error) {
      console.error("Failed to fetch permissions:", error)
    }
  }, [session?.user?.id, status, store.currentEnterpriseId, store.currentOrganizationId])

  useEffect(() => {
    if (status === "authenticated" && !store.isInitialized) {
      fetchPermissions()
    }
  }, [status, store.isInitialized, fetchPermissions])

  const setEnterpriseContext = useCallback(
    (enterpriseId: string | null) => {
      store.setCurrentEnterprise(enterpriseId)
      // Re-initialize to trigger permission refresh
      useAuthStore.setState({ isInitialized: false })
    },
    [store]
  )

  const setOrganizationContext = useCallback(
    (orgId: string | null) => {
      store.setCurrentOrganization(orgId)
      useAuthStore.setState({ isInitialized: false })
    },
    [store]
  )

  return {
    user: session?.user || null,
    role,
    permissions: store.permissions,
    currentEnterpriseId: store.currentEnterpriseId,
    currentOrganizationId: store.currentOrganizationId,
    accessibleEnterprises: store.accessibleEnterprises,
    accessibleOrganizations: store.accessibleOrganizations,
    isAdmin: isAdminRole(role),
    isSuperAdmin: role === "SUPER_ADMIN",
    isLoading: status === "loading" || !store.isInitialized,
    can: (permission: Permission) => hasPermission(store.permissions, permission),
    canAny: (perms: Permission[]) => hasAnyPermission(store.permissions, perms),
    canAll: (perms: Permission[]) => hasAllPermissions(store.permissions, perms),
    canManageRole: (targetRole: Role) => canManageRole(role, targetRole),
    setEnterpriseContext,
    setOrganizationContext,
    refreshPermissions: fetchPermissions,
  }
}
