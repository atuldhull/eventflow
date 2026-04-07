"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { ArrowLeft, Loader2, Mail } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { OTPInput } from "@/components/forms/OTPInput"
import { useAuth } from "@/hooks/useAuth"

export default function VerifyEmailPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const emailParam = searchParams.get("email") || ""

  const { sendOtp, verifyEmail } = useAuth()

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
    try {
      await verifyEmail(email, code)
      toast.success("Email verified successfully!")
      router.push("/dashboard")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Verification failed")
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
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4">
          <Mail className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">Verify your email</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {otpSent
            ? `Enter the 6-digit code sent to ${email}`
            : "Enter your email to receive a verification code"}
        </p>
      </div>

      {!otpSent ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="verify-email">Email</Label>
            <Input
              id="verify-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <Button type="button" className="w-full" onClick={handleSendCode} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send Verification Code
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <OTPInput onComplete={handleVerify} disabled={isSubmitting} />
          <div className="text-center space-y-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleSendCode}
              disabled={resendTimer > 0 || isSubmitting}
            >
              {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend code"}
            </Button>
            <div>
              <button
                type="button"
                onClick={() => {
                  setOtpSent(false)
                  setEmail("")
                }}
                className="text-xs text-muted-foreground hover:text-primary"
              >
                Use a different email
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="text-center">
        <Link href="/login" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft className="mr-1 h-3.5 w-3.5" />
          Back to login
        </Link>
      </div>
    </div>
  )
}
