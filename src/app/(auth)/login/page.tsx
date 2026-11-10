"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Eye, EyeOff, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CodeBoxes } from "../_components/CodeBoxes"
import { AuthAlert, AuthHeading, FieldError, authAction, authField, revealButton } from "../_components/ui"
import { SocialLoginButtons } from "@/components/forms/SocialLoginButtons"
import { useAuth } from "@/hooks/useAuth"
import { loginSchema, type LoginInput } from "@/lib/validations/auth"
import { getSafeCallbackUrl } from "@/lib/auth-redirect"
import { getAuthPageErrorMessage, SignInFailure } from "@/lib/auth-errors"
import { cn } from "@/lib/utils"

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // Only same-site paths: anything else in ?callbackUrl= would be an open redirect
  const callbackUrl = getSafeCallbackUrl(searchParams.get("callbackUrl")) ?? undefined
  const errorMessage = getAuthPageErrorMessage(searchParams.get("error"), searchParams.get("code"))
  const { login, sendOtp, loginWithOtp } = useAuth()

  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // OTP state
  const [otpEmail, setOtpEmail] = useState("")
  const [otpSent, setOtpSent] = useState(false)
  const [otpLoading, setOtpLoading] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  })

  const onPasswordLogin = async (data: LoginInput) => {
    setIsSubmitting(true)
    try {
      await login(data.email, data.password, callbackUrl)
      toast.success("Logged in successfully!")
    } catch (error) {
      if (error instanceof SignInFailure && error.code === "EMAIL_NOT_VERIFIED") {
        // The password was right, so offer the way out: send a code and open the verify page
        toast.error(error.message, {
          action: { label: "Verify email", onClick: () => void startEmailVerification(data.email) },
        })
      } else {
        toast.error(error instanceof Error ? error.message : "Login failed")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const startEmailVerification = async (email: string) => {
    try {
      await sendOtp(email, "VERIFY_EMAIL")
      const params = new URLSearchParams({ email: email.toLowerCase().trim() })
      if (callbackUrl) params.set("callbackUrl", callbackUrl)
      router.push(`/verify-email?${params}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send verification code")
    }
  }

  const handleSendOtp = async () => {
    if (!otpEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(otpEmail)) {
      toast.error("Please enter a valid email address")
      return
    }

    setOtpLoading(true)
    try {
      await sendOtp(otpEmail, "LOGIN")
      setOtpSent(true)
      toast.success("OTP sent to your email")
      startResendTimer()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send OTP")
    } finally {
      setOtpLoading(false)
    }
  }

  const handleOtpComplete = async (code: string) => {
    setIsSubmitting(true)
    try {
      await loginWithOtp(otpEmail, code, callbackUrl)
      toast.success("Logged in successfully!")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invalid OTP")
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
      <AuthHeading eyebrow="Sign in" title="Welcome" mark="back" after=".">
        Sign in to your EventFlow account.
      </AuthHeading>

      {errorMessage && <AuthAlert>{errorMessage}</AuthAlert>}

      <Tabs defaultValue="password" className="w-full gap-7">
        <TabsList className="grid h-12! w-full grid-cols-2 p-1 pointer-coarse:h-12!">
          <TabsTrigger value="password">Email &amp; password</TabsTrigger>
          <TabsTrigger value="otp">Login with OTP</TabsTrigger>
        </TabsList>

        <TabsContent value="password">
          <form onSubmit={handleSubmit(onPasswordLogin)} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                className={authField}
                aria-invalid={errors.email ? true : undefined}
                aria-describedby={errors.email ? "email-error" : undefined}
                {...register("email")}
              />
              {errors.email && <FieldError id="email-error">{errors.email.message}</FieldError>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  className={cn(authField, "pr-12")}
                  aria-invalid={errors.password ? true : undefined}
                  aria-describedby={errors.password ? "password-error" : undefined}
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={revealButton}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {errors.password && <FieldError id="password-error">{errors.password.message}</FieldError>}
            </div>

            <Button type="submit" size="lg" className={cn(authAction, "w-full")} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Sign in
            </Button>

            {/* after the submit button, so the tab order runs email → password → Sign in */}
            <p className="text-center">
              <Link href="/forgot-password" className="text-[13px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                Forgot password?
              </Link>
            </p>
          </form>
        </TabsContent>

        <TabsContent value="otp">
          {!otpSent ? (
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault()
                handleSendOtp()
              }}
              className="space-y-5"
            >
              <div className="space-y-2">
                <Label htmlFor="otp-email">Email</Label>
                <Input
                  id="otp-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  className={authField}
                  value={otpEmail}
                  onChange={(e) => setOtpEmail(e.target.value)}
                />
                <p className="text-[13px] text-muted-foreground">We&apos;ll email you a 6-digit code to sign in.</p>
              </div>
              <Button type="submit" size="lg" className={cn(authAction, "w-full")} disabled={otpLoading}>
                {otpLoading && <Loader2 className="size-4 animate-spin" aria-hidden />}
                Send OTP
              </Button>
            </form>
          ) : (
            <div className="space-y-5">
              <p className="text-[15px] leading-relaxed text-muted-foreground">
                Enter the 6-digit code sent to <span className="font-medium break-all text-foreground">{otpEmail}</span>
              </p>
              <CodeBoxes onComplete={handleOtpComplete} disabled={isSubmitting} />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button type="button" variant="ghost" size="sm" className="-ml-3 tabular-nums" onClick={handleSendOtp} disabled={resendTimer > 0 || otpLoading}>
                  {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend OTP"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="-mr-3 text-muted-foreground"
                  onClick={() => {
                    setOtpSent(false)
                    setOtpEmail("")
                  }}
                >
                  Use a different email
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <div className="empty:hidden [&_button]:h-12">
        <SocialLoginButtons mode="login" callbackUrl={callbackUrl} />
      </div>

      <p className="border-t pt-6 text-center text-sm text-muted-foreground">
        New to EventFlow?{" "}
        <Link
          href={callbackUrl ? `/signup?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/signup"}
          className="font-semibold text-foreground underline decoration-lavender decoration-2 underline-offset-4 transition-colors hover:decoration-foreground"
        >
          Create an account
        </Link>
      </p>
    </div>
  )
}
