import type { Role } from "@/lib/constants"

export interface AuthUser {
  id: string
  email: string
  name: string
  role: Role
  avatar?: string | null
  isActive: boolean
}

export interface SessionUser extends AuthUser {
  enterpriseMemberships?: { enterpriseId: string; role: Role }[]
  organizationMemberships?: { organizationId: string; role: Role }[]
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface SignupData {
  email: string
  password: string
  confirmPassword: string
  name: string
  phone?: string
  collegeName?: string
  companyName?: string
  agreeToTerms: boolean
}

export interface OTPData {
  email: string
  otp: string
}

export interface ResetPasswordData {
  email: string
  otp: string
  newPassword: string
  confirmPassword: string
}

export interface AuthResponse {
  success: boolean
  message: string
  data?: Record<string, unknown>
  error?: string
}
