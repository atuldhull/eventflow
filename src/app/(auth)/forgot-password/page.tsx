"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Eye, EyeOff, ArrowLeft, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { OTPInput } from "@/components/forms/OTPInput"
import { PasswordStrength } from "@/components/forms/PasswordStrength"
import { useAuth } from "@/hooks/useAuth"
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  type ForgotPasswordInput,
  type ResetPasswordInput,
} from "@/lib/validations/auth"

type Step = "email" | "reset"

export default function ForgotPasswordPage() {
  const router = useRouter()
  const { forgotPassword, resetPassword } = useAuth()

  const [step, setStep] = useState<Step>("email")
  const [emailValue, setEmailValue] = useState("")
  const [otpValue, setOtpValue] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)

  const emailForm = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
  })

  const resetForm = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
  })

  const newPassword = resetForm.watch("newPassword", "")

  const handleSendResetCode = async (data: ForgotPasswordInput) => {
    setIsSubmitting(true)
    try {
      await forgotPassword(data.email)
      setEmailValue(data.email)
      resetForm.setValue("email", data.email)
      setStep("reset")
      toast.success("If an account exists, a reset code has been sent.")
      startResendTimer()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOtpComplete = (code: string) => {
    setOtpValue(code)
    resetForm.setValue("otp", code)
  }

  const handleResetPassword = async (data: ResetPasswordInput) => {
    if (!otpValue) {
      toast.error("Please enter the verification code")
      return
    }
    setIsSubmitting(true)
    try {
      await resetPassword({ ...data, email: emailValue, otp: otpValue })
      toast.success("Password reset successfully!")
      setTimeout(() => router.push("/login"), 2000)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Reset failed")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResend = async () => {
    try {
      await forgotPassword(emailValue)
      toast.success("New code sent to your email")
      startResendTimer()
    } catch {
      toast.error("Failed to resend code")
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
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Reset your password</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {step === "email"
            ? "Enter your email and we'll send you a reset code"
            : `Enter the code sent to ${emailValue}`}
        </p>
      </div>

      {step === "email" && (
        <form onSubmit={emailForm.handleSubmit(handleSendResetCode)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reset-email">Email</Label>
            <Input
              id="reset-email"
              type="email"
              placeholder="you@example.com"
              {...emailForm.register("email")}
            />
            {emailForm.formState.errors.email && (
              <p className="text-xs text-destructive">{emailForm.formState.errors.email.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send Reset Code
          </Button>
        </form>
      )}

      {step === "reset" && (
        <form onSubmit={resetForm.handleSubmit(handleResetPassword)} className="space-y-4">
          <div className="space-y-2">
            <Label>Verification Code</Label>
            <OTPInput onComplete={handleOtpComplete} />
            <div className="text-center">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleResend}
                disabled={resendTimer > 0}
              >
                {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend code"}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-password">New Password</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter new password"
                className="pr-9"
                {...resetForm.register("newPassword")}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {resetForm.formState.errors.newPassword && (
              <p className="text-xs text-destructive">{resetForm.formState.errors.newPassword.message}</p>
            )}
            <PasswordStrength password={newPassword} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-new-password">Confirm Password</Label>
            <div className="relative">
              <Input
                id="confirm-new-password"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm new password"
                className="pr-9"
                {...resetForm.register("confirmPassword")}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {resetForm.formState.errors.confirmPassword && (
              <p className="text-xs text-destructive">{resetForm.formState.errors.confirmPassword.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Reset Password
          </Button>
        </form>
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
