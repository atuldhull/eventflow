"use client"

import type { ReactNode } from "react"
import { usePermissions } from "@/hooks/usePermissions"
import type { Permission } from "@/lib/permissions"

interface PermissionGateProps {
  permission: Permission | Permission[]
  requireAll?: boolean
  fallback?: ReactNode
  children: ReactNode
}

export function PermissionGate({
  permission,
  requireAll = false,
  fallback = null,
  children,
}: PermissionGateProps) {
  const { hasPermission, hasAnyPermission, hasAllPermissions, isLoading } = usePermissions()

  if (isLoading) return null

  const permissions = Array.isArray(permission) ? permission : [permission]

  const hasAccess = permissions.length === 1
    ? hasPermission(permissions[0])
    : requireAll
      ? hasAllPermissions(permissions)
      : hasAnyPermission(permissions)

  if (!hasAccess) return <>{fallback}</>

  return <>{children}</>
}
