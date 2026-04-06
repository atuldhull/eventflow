import type { Role } from "@/lib/constants"

export interface User {
  id: string
  name: string
  email: string
  image?: string
  role: Role
  organizationId?: string
}

export interface Session {
  user: User
  expires: string
}
