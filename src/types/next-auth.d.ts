import type { Role } from "@/lib/constants"
import type { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface User {
    id: string
    role: Role
    isActive: boolean
    isBanned: boolean
    avatar?: string | null
  }

  interface Session {
    user: {
      id: string
      role: Role
      avatar?: string | null
    } & DefaultSession["user"]
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role: Role
    avatar?: string | null
    lastRefreshed?: number
  }
}
