"use client"

import { useSession, signIn, getSession } from "next-auth/react"
import { signOut } from "@/lib/sign-out"
import { useRouter } from "next/navigation"
import type { Role } from "@/lib/constants"
import { getPostLoginPath, getSafeCallbackUrl } from "@/lib/auth-redirect"
import { getSignInFailure } from "@/lib/auth-errors"
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

  // `user` above is the session from before this sign-in (none), so the role for the
  // landing page has to come from the session the sign-in just created
  const goToPostLoginPage = async (callbackUrl?: string) => {
    const fresh = await getSession()
    router.push(getPostLoginPath(callbackUrl, fresh?.user?.role))
    router.refresh()
  }

  const login = async (email: string, password: string, callbackUrl?: string) => {
    const result = await signIn("credentials", {
      email: email.toLowerCase().trim(),
      password,
      redirect: false,
    })

    const failure = getSignInFailure(result, "password")
    if (failure) throw failure

    await goToPostLoginPage(callbackUrl)
  }

  const loginWithOtp = async (email: string, otp: string, callbackUrl?: string) => {
    const result = await signIn("otp", {
      email: email.toLowerCase().trim(),
      otp,
      redirect: false,
    })

    const failure = getSignInFailure(result, "otp")
    if (failure) throw failure

    await goToPostLoginPage(callbackUrl)
  }

  // An OAuth round trip can't know the role in advance. Without a callbackUrl it returns to
  // /login, which the middleware forwards a signed-in user to their role's home page.
  const loginWithGoogle = async (callbackUrl?: string) => {
    await signIn("google", { callbackUrl: getSafeCallbackUrl(callbackUrl) ?? "/login" })
  }

  const loginWithMicrosoft = async (callbackUrl?: string) => {
    await signIn("microsoft-entra-id", { callbackUrl: getSafeCallbackUrl(callbackUrl) ?? "/login" })
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

    const result = (await res.json()) as AuthResponse & { errors?: Record<string, string[] | undefined> }

    if (!result.success) {
      // keep the API's per-field messages (e.g. errors.phone) so the form can show them by the field
      throw Object.assign(new Error(result.message), { fieldErrors: result.errors ?? {} })
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

  /** `signIn: true` asks for a one-time sign-in code to start a session right after verifying. */
  const verifyEmail = async (email: string, otp: string, options?: { signIn?: boolean }) => {
    const res = await fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.toLowerCase().trim(), otp, ...(options?.signIn ? { signIn: true } : {}) }),
    })

    const result = (await res.json()) as AuthResponse & { data?: { loginCode?: string } }

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
