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
import { CodeBoxes } from "../_components/CodeBoxes"
import { AuthHeading, FieldError, authAction, authField, revealButton } from "../_components/ui"
import { cn } from "@/lib/utils"
import { PasswordStrength } from "@/components/forms/PasswordStrength"
import { useAuth } from "@/hooks/useAuth"
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  type ForgotPasswordInput,
  type ResetPasswordInput,
} from "@/lib/validations/auth"

type Step = "email" | "reset"

/** the eye toggle inside a password field: covers the field's full height */
function RevealButton({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={revealButton}
      aria-label={shown ? "Hide password" : "Show password"}
    >
      {shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
    </button>
  )
}

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
    <div className="space-y-8">
      <AuthHeading eyebrow="Forgot password" title="Reset your" mark="password" after=".">
        {step === "email" ? (
          "Enter your email and we'll send you a reset code"
        ) : (
          <>
            Enter the code sent to <span className="font-medium break-all text-foreground">{emailValue}</span>
          </>
        )}
      </AuthHeading>

      {step === "email" && (
        <form onSubmit={emailForm.handleSubmit(handleSendResetCode)} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="reset-email">Email</Label>
            <Input
              id="reset-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              className={authField}
              aria-invalid={emailForm.formState.errors.email ? true : undefined}
              {...emailForm.register("email")}
            />
            {emailForm.formState.errors.email && (
              <FieldError>{emailForm.formState.errors.email.message}</FieldError>
            )}
          </div>

          <Button type="submit" size="lg" className={cn(authAction, "w-full")} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Send reset code
          </Button>
        </form>
      )}

      {step === "reset" && (
        <form onSubmit={resetForm.handleSubmit(handleResetPassword)} className="space-y-5">
          <div className="space-y-2" role="group" aria-labelledby="reset-code-label">
            <p id="reset-code-label" className="pb-1 text-sm leading-none font-medium">Verification code</p>
            <CodeBoxes onComplete={handleOtpComplete} />
            <Button type="button" variant="ghost" size="sm" className="-ml-3 tabular-nums" onClick={handleResend} disabled={resendTimer > 0}>
              {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend code"}
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Enter new password"
                className={cn(authField, "pr-12")}
                aria-invalid={resetForm.formState.errors.newPassword ? true : undefined}
                {...resetForm.register("newPassword")}
              />
              <RevealButton shown={showPassword} onToggle={() => setShowPassword(!showPassword)} />
            </div>
            {resetForm.formState.errors.newPassword && (
              <FieldError>{resetForm.formState.errors.newPassword.message}</FieldError>
            )}
            <PasswordStrength password={newPassword} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-new-password">Confirm password</Label>
            <div className="relative">
              <Input
                id="confirm-new-password"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Confirm new password"
                className={cn(authField, "pr-12")}
                aria-invalid={resetForm.formState.errors.confirmPassword ? true : undefined}
                {...resetForm.register("confirmPassword")}
              />
              <RevealButton shown={showConfirmPassword} onToggle={() => setShowConfirmPassword(!showConfirmPassword)} />
            </div>
            {resetForm.formState.errors.confirmPassword && (
              <FieldError>{resetForm.formState.errors.confirmPassword.message}</FieldError>
            )}
          </div>

          <Button type="submit" size="lg" className={cn(authAction, "w-full")} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Reset password
          </Button>
        </form>
      )}

      <Link href="/login" className="group inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" aria-hidden />
        Back to login
      </Link>
    </div>
  )
}
