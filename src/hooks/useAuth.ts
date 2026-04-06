"use client"

import { useSession } from "next-auth/react"
import type { Role } from "@/lib/constants"

export function useAuth() {
  const { data: session, status } = useSession()

  const isAuthenticated = status === "authenticated"
  const isLoading = status === "loading"
  const user = session?.user

  const hasRole = (role: Role) => {
    return user?.role === role
  }

  const hasAnyRole = (roles: Role[]) => {
    return roles.some((role) => user?.role === role)
  }

  return {
    user,
    session,
    isAuthenticated,
    isLoading,
    hasRole,
    hasAnyRole,
  }
}
