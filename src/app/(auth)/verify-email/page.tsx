"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { ArrowLeft, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CodeBoxes } from "../_components/CodeBoxes"
import { AuthHeading, authAction, authField } from "../_components/ui"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/useAuth"
import { getSafeCallbackUrl } from "@/lib/auth-redirect"

export default function VerifyEmailPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const emailParam = searchParams.get("email") || ""
  // Only same-site paths: anything else in ?callbackUrl= would be an open redirect
  const callbackUrl = getSafeCallbackUrl(searchParams.get("callbackUrl"))

  const { sendOtp, verifyEmail, loginWithOtp } = useAuth()

  const [email, setEmail] = useState(emailParam)
  const [otpSent, setOtpSent] = useState(!!emailParam)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)

  const handleSendCode = async () => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Please enter a valid email address")
      return
    }

    setIsSubmitting(true)
    try {
      await sendOtp(email, "VERIFY_EMAIL")
      setOtpSent(true)
      toast.success("Verification code sent to your email")
      startResendTimer()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send code")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleVerify = async (code: string) => {
    setIsSubmitting(true)
    let loginCode: string | undefined
    try {
      const result = await verifyEmail(email, code, { signIn: true })
      loginCode = result.data?.loginCode
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Verification failed")
      setIsSubmitting(false)
      return
    }
    // The code just proved this inbox is theirs, so the server handed back a one-time
    // sign-in code: use it straight away instead of sending them to log in again
    try {
      if (!loginCode) throw new Error("no sign-in code")
      await loginWithOtp(email, loginCode, callbackUrl ?? undefined)
      toast.success("Email verified! You're signed in.")
    } catch {
      toast.success("Email verified! Please log in.")
      router.push(callbackUrl ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/login")
    } finally {
      setIsSubmitting(false)
    }
  }

  const startResendTimer = () => {
    setResendTimer(30)
    const interval = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  return (
    <div className="space-y-8">
      <AuthHeading eyebrow="One last step" title="Verify your" mark="email" after=".">
        {otpSent ? (
          <>
            Enter the 6-digit code sent to <span className="font-medium break-all text-foreground">{email}</span>
          </>
        ) : (
          "Enter your email to receive a verification code"
        )}
      </AuthHeading>

      {!otpSent ? (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            handleSendCode()
          }}
          className="space-y-5"
        >
          <div className="space-y-2">
            <Label htmlFor="verify-email">Email</Label>
            <Input id="verify-email" type="email" autoComplete="email" placeholder="you@example.com" className={authField} value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <Button type="submit" size="lg" className={cn(authAction, "w-full")} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Send verification code
          </Button>
        </form>
      ) : (
        <div className="space-y-5">
          <CodeBoxes onComplete={handleVerify} disabled={isSubmitting} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button type="button" variant="ghost" size="sm" className="-ml-3 tabular-nums" onClick={handleSendCode} disabled={resendTimer > 0 || isSubmitting}>
              {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend code"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="-mr-3 text-muted-foreground"
              onClick={() => {
                setOtpSent(false)
                setEmail("")
              }}
            >
              Use a different email
            </Button>
          </div>
        </div>
      )}

      <Link href="/login" className="group inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" aria-hidden />
        Back to login
      </Link>
    </div>
  )
}
