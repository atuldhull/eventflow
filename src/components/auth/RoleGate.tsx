"use client"

import type { ReactNode } from "react"
import { useSession } from "next-auth/react"
import type { Role } from "@/lib/constants"

interface RoleGateProps {
  roles: Role | Role[]
  fallback?: ReactNode
  children: ReactNode
}

export function RoleGate({ roles, fallback = null, children }: RoleGateProps) {
  const { data: session, status } = useSession()

  if (status === "loading") return null

  const allowedRoles = Array.isArray(roles) ? roles : [roles]
  const userRole = session?.user?.role as Role | undefined

  if (!userRole || !allowedRoles.includes(userRole)) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
