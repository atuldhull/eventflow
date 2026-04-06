import type { Role } from "@/lib/constants"

export interface UserProfile {
  id: string
  name: string
  email: string
  image?: string
  bio?: string
  role: Role
  organizationId?: string
  createdAt: Date
}
