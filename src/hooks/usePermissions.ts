"use client"

import { useSession } from "next-auth/react"
import { useAuthStore } from "@/stores/useAuthStore"
import type { Permission } from "@/lib/permissions"
import {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  isAdminRole,
} from "@/lib/permissions"
import type { Role } from "@/lib/constants"

export function usePermissions() {
  const { data: session } = useSession()
  const { permissions, isInitialized } = useAuthStore()

  const role = (session?.user?.role || "USER") as Role

  return {
    permissions,
    role,
    isInitialized,
    isAdmin: isAdminRole(role),
    isSuperAdmin: role === "SUPER_ADMIN",
    hasPermission: (permission: Permission) => hasPermission(permissions, permission),
    hasAnyPermission: (perms: Permission[]) => hasAnyPermission(permissions, perms),
    hasAllPermissions: (perms: Permission[]) => hasAllPermissions(permissions, perms),
    isLoading: !isInitialized,
  }
}
