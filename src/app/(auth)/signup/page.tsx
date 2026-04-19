"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Eye, EyeOff, ArrowLeft, ArrowRight, Loader2, Check, Mail } from "lucide-react"
import { AutocompleteInput } from "@/components/shared/AutocompleteInput"
import { searchColleges, searchCompanies } from "@/lib/data/colleges"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { OTPInput } from "@/components/forms/OTPInput"
import { PasswordStrength } from "@/components/forms/PasswordStrength"
import { SocialLoginButtons } from "@/components/forms/SocialLoginButtons"
import { useAuth } from "@/hooks/useAuth"
import { signupSchema, type SignupInput } from "@/lib/validations/auth"
import { PageTransition } from "@/components/motion/primitives"

type Step = 1 | 2 | 3

export default function SignupPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard"
  const { signup, sendOtp, verifyEmail } = useAuth()

  const [step, setStep] = useState<Step>(1)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)

  const {
    register,
    handleSubmit,
    watch,
    trigger,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      agreeToTerms: false as unknown as true,
    },
  })

  const password = watch("password", "")
  const email = watch("email", "")

  const handleStep1Next = async () => {
    const valid = await trigger(["name", "email", "password", "confirmPassword", "agreeToTerms"])
    if (valid) setStep(2)
  }

  const handleStep2Next = async () => {
    setIsSubmitting(true)
    try {
      const data = getValues()
      await signup(data)
      toast.success("Account created! Check your email for verification code.")
      setStep(3)
      startResendTimer()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Signup failed")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleVerifyOtp = async (code: string) => {
    setIsSubmitting(true)
    try {
      await verifyEmail(email, code)
      toast.success("Email verified! Welcome to EventFlow!")
      router.push(callbackUrl)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Verification failed")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResendOtp = async () => {
    try {
      await sendOtp(email, "VERIFY_EMAIL")
      toast.success("New code sent to your email")
      startResendTimer()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to resend code")
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
    <PageTransition className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Create an account</h2>
        <p className="text-sm text-muted-foreground mt-1">Get started with EventFlow</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                s < step
                  ? "bg-primary text-primary-foreground"
                  : s === step
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {s < step ? <Check className="h-3.5 w-3.5" /> : s}
            </div>
            {s < 3 && (
              <div
                className={`h-0.5 w-8 transition-colors ${
                  s < step ? "bg-primary" : "bg-muted"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
        {/* Step 1: Account */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" placeholder="John Doe" {...register("name")} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="signup-email">Email</Label>
              <Input id="signup-email" type="email" placeholder="you@example.com" {...register("email")} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="signup-password">Password</Label>
              <div className="relative">
                <Input
                  id="signup-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a password"
                  className="pr-9"
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
              <PasswordStrength password={password} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm your password"
                  className="pr-9"
                  {...register("confirmPassword")}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
              )}
            </div>

            <div className="flex items-start gap-2">
              <Checkbox
                id="terms"
                checked={watch("agreeToTerms") as boolean}
                onCheckedChange={(checked) => setValue("agreeToTerms", checked === true ? true : (false as unknown as true), { shouldValidate: true })}
              />
              <label htmlFor="terms" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                I agree to the{" "}
                <Link href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  Privacy Policy
                </Link>
              </label>
            </div>
            {errors.agreeToTerms && (
              <p className="text-xs text-destructive">{errors.agreeToTerms.message}</p>
            )}

            <Button type="button" className="w-full" onClick={handleStep1Next}>
              Next <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Step 2: Details */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              These details are optional. You can add them later.
            </p>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <div className="flex gap-2">
                <div className="flex items-center rounded-lg border bg-muted px-3 text-sm text-muted-foreground">
                  +91
                </div>
                <Input id="phone" placeholder="9876543210" {...register("phone")} />
              </div>
              {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="college">College / University</Label>
              <AutocompleteInput
                id="college"
                value={watch("collegeName") || ""}
                onChange={(v) => setValue("collegeName", v)}
                searchFn={searchColleges}
                placeholder="Start typing... e.g. IIT, BITS, VIT"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <AutocompleteInput
                id="company"
                value={watch("companyName") || ""}
                onChange={(v) => setValue("companyName", v)}
                searchFn={searchCompanies}
                placeholder="Start typing... e.g. Google, TCS"
              />
            </div>

            <div className="flex gap-3">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(1)}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <Button type="button" variant="outline" className="flex-1" onClick={handleStep2Next} disabled={isSubmitting}>
                Skip
              </Button>
              <Button type="button" className="flex-1" onClick={handleStep2Next} disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Next
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Verify Email */}
        {step === 3 && (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Mail className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">
              We&apos;ve sent a 6-digit code to <strong>{email}</strong>
            </p>
            <OTPInput onComplete={handleVerifyOtp} disabled={isSubmitting} />
            <div className="space-y-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleResendOtp}
                disabled={resendTimer > 0}
              >
                {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend code"}
              </Button>
              <div>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="text-xs text-muted-foreground hover:text-primary"
                >
                  <ArrowLeft className="inline h-3 w-3 mr-1" />
                  Go back
                </button>
              </div>
            </div>
          </div>
        )}
      </form>

      {step === 1 && <SocialLoginButtons mode="signup" />}

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Log in
        </Link>
      </p>
    </PageTransition>
  )
}
