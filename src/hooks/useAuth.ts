"use client"

import { useSession, signIn, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import type { Role } from "@/lib/constants"
import { getRoleRedirectPath } from "@/lib/auth-helpers"
import type { AuthResponse } from "@/types/auth"

const ADMIN_ROLES: Role[] = [
  "SUPER_ADMIN",
  "ENTERPRISE_ADMIN",
  "ENTERPRISE_MANAGER",
  "ORG_ADMIN",
  "EVENT_MANAGER",
  "COORDINATOR",
  "FINANCE_MANAGER",
  "VIEWER",
]

export function useAuth() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const isAuthenticated = status === "authenticated"
  const isLoading = status === "loading"
  const user = session?.user

  const isAdmin = user?.role ? ADMIN_ROLES.includes(user.role) : false
  const isSuperAdmin = user?.role === "SUPER_ADMIN"
  const isEnterpriseAdmin = user?.role === "ENTERPRISE_ADMIN"
  const isOrgAdmin = user?.role === "ORG_ADMIN"

  const login = async (email: string, password: string, callbackUrl?: string) => {
    const result = await signIn("credentials", {
      email: email.toLowerCase().trim(),
      password,
      redirect: false,
    })

    if (result?.error) {
      if (result.error === "ACCOUNT_INACTIVE") {
        throw new Error("Your account has been suspended. Contact support.")
      }
      if (result.error === "ACCOUNT_BANNED") {
        throw new Error("Your account has been suspended. Contact support.")
      }
      if (result.error === "EMAIL_NOT_VERIFIED") {
        throw new Error("Please verify your email before logging in.")
      }
      throw new Error("Invalid email or password.")
    }

    if (result?.ok) {
      router.push(callbackUrl || getRoleRedirectPath(user?.role || "USER"))
      router.refresh()
    }
  }

  const loginWithOtp = async (email: string, otp: string, callbackUrl?: string) => {
    const res = await fetch("/api/auth/login-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.toLowerCase().trim(), otp }),
    })

    const data: AuthResponse = await res.json()

    if (!data.success) {
      throw new Error(data.message)
    }

    // Sign in with credentials after OTP verification
    const result = await signIn("credentials", {
      email: email.toLowerCase().trim(),
      password: "__otp_verified__",
      redirect: false,
    })

    if (result?.ok) {
      router.push(callbackUrl || "/dashboard")
      router.refresh()
    }
  }

  const loginWithGoogle = async (callbackUrl?: string) => {
    await signIn("google", { callbackUrl: callbackUrl || "/dashboard" })
  }

  const loginWithMicrosoft = async (callbackUrl?: string) => {
    await signIn("microsoft-entra-id", { callbackUrl: callbackUrl || "/dashboard" })
  }

  const logout = async () => {
    await signOut({ callbackUrl: "/" })
  }

  const signup = async (data: {
    email: string
    password: string
    confirmPassword: string
    name: string
    phone?: string
    collegeName?: string
    companyName?: string
    agreeToTerms: boolean
  }) => {
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })

    const result: AuthResponse = await res.json()

    if (!result.success) {
      throw new Error(result.message)
    }

    return result
  }

  const sendOtp = async (email: string, purpose: "LOGIN" | "VERIFY_EMAIL" | "RESET_PASSWORD") => {
    const res = await fetch("/api/auth/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.toLowerCase().trim(), purpose }),
    })

    const result: AuthResponse = await res.json()

    if (!result.success) {
      throw new Error(result.message)
    }

    return result
  }

  const verifyEmail = async (email: string, otp: string) => {
    const res = await fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.toLowerCase().trim(), otp }),
    })

    const result: AuthResponse = await res.json()

    if (!result.success) {
      throw new Error(result.message)
    }

    return result
  }

  const forgotPassword = async (email: string) => {
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.toLowerCase().trim() }),
    })

    const result: AuthResponse = await res.json()

    if (!result.success) {
      throw new Error(result.message)
    }

    return result
  }

  const resetPassword = async (data: {
    email: string
    otp: string
    newPassword: string
    confirmPassword: string
  }) => {
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })

    const result: AuthResponse = await res.json()

    if (!result.success) {
      throw new Error(result.message)
    }

    return result
  }

  return {
    user,
    session,
    isAuthenticated,
    isLoading,
    isAdmin,
    isSuperAdmin,
    isEnterpriseAdmin,
    isOrgAdmin,
    login,
    loginWithOtp,
    loginWithGoogle,
    loginWithMicrosoft,
    logout,
    signup,
    sendOtp,
    verifyEmail,
    forgotPassword,
    resetPassword,
  }
}
