"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Eye, EyeOff, ArrowLeft, ArrowRight, Loader2 } from "lucide-react"
import { AutocompleteInput } from "@/components/shared/AutocompleteInput"
import { searchColleges, searchCompanies } from "@/lib/data/colleges"

import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { CodeBoxes } from "../_components/CodeBoxes"
import { AuthHeading, FieldError, authAction, authField, revealButton } from "../_components/ui"
import { PasswordStrength } from "@/components/forms/PasswordStrength"
import { SocialLoginButtons } from "@/components/forms/SocialLoginButtons"
import { useAuth } from "@/hooks/useAuth"
import { signupSchema, type SignupInput } from "@/lib/validations/auth"
import { getSafeCallbackUrl } from "@/lib/auth-redirect"
import { cn } from "@/lib/utils"

type Step = 1 | 2 | 3

const STEP_LABELS: Record<Step, string> = { 1: "Account", 2: "Details", 3: "Verify email" }

/** Which step shows each field, to send someone back to the field the API refused. */
const FIELD_STEP: Record<string, Step> = {
  name: 1, email: 1, password: 1, confirmPassword: 1, agreeToTerms: 1, phone: 2, collegeName: 2, companyName: 2,
}

/** An Indian mobile number as its 10 digits (drops spaces, dashes, +91 or a leading 0). */
function normalizePhone(value: string | undefined): string {
  const digits = (value ?? "").replace(/\D/g, "")
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2)
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1)
  return digits || (value ?? "").trim()
}

/** aria wiring for a field: invalid, and described by its error message (id `${name}-error`) */
function fieldA11y(name: string, hasError: boolean) {
  return hasError ? { "aria-invalid": true as const, "aria-describedby": `${name}-error` } : {}
}

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

export default function SignupPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // Only same-site paths: anything else in ?callbackUrl= would be an open redirect
  const callbackUrl = getSafeCallbackUrl(searchParams.get("callbackUrl")) ?? undefined
  const { signup, sendOtp, verifyEmail, login } = useAuth()

  const [step, setStep] = useState<Step>(1)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)
  // Settings → User registration: null until known (the form shows meanwhile; POST enforces it)
  const [signupOpen, setSignupOpen] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch("/api/auth/signup")
      .then((r) => r.json())
      .then((json) => { if (!cancelled && json?.success) setSignupOpen(json.data?.open !== false) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const {
    register,
    watch,
    trigger,
    getValues,
    setValue,
    setError,
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
    // "+91 98765-43210" and "098765 43210" mean the same number: keep the 10 digits
    const phone = normalizePhone(getValues("phone"))
    setValue("phone", phone)
    if (!(await trigger(["phone"]))) return

    setIsSubmitting(true)
    try {
      const data = getValues()
      await signup(data)
      toast.success("Account created! Check your email for verification code.")
      setStep(3)
      startResendTimer()
    } catch (error) {
      // Put the API's messages next to their fields; a step-1 field sends them back there
      const fieldErrors = (error as { fieldErrors?: Record<string, string[] | undefined> }).fieldErrors ?? {}
      const fields = Object.entries(fieldErrors).filter(([key, msgs]) => key in FIELD_STEP && msgs?.[0])
      for (const [key, msgs] of fields) setError(key as keyof SignupInput, { type: "server", message: msgs![0] })
      if (fields.some(([key]) => FIELD_STEP[key] === 1)) setStep(1)
      toast.error(error instanceof Error ? error.message : "Signup failed")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleVerifyOtp = async (code: string) => {
    setIsSubmitting(true)
    try {
      await verifyEmail(email, code)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Verification failed")
      setIsSubmitting(false)
      return
    }
    // Verified: sign in with the password just chosen instead of sending them to log in again
    try {
      await login(email, getValues("password"), callbackUrl)
      toast.success("Email verified! Welcome to EventFlow!")
    } catch {
      toast.success("Email verified! Please log in.")
      router.push(callbackUrl ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/login")
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

  const loginHref = callbackUrl ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/login"

  // Registration is switched off: say so before anyone fills in the form
  if (signupOpen === false && step === 1) {
    return (
      <div className="space-y-8">
        <AuthHeading role="status" eyebrow="Sign up" title="Sign-ups are currently" mark="closed">
          New accounts can&apos;t be created right now. If you already have an account, log in instead.
        </AuthHeading>
        <Link href={loginHref} className={cn(buttonVariants({ size: "lg" }), authAction, "w-full")}>Log in</Link>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <AuthHeading eyebrow="Sign up" title="Create an" mark="account" after=".">
        Get started with EventFlow
      </AuthHeading>

      {/* Progress: three segments that fill in lavender, and the step's name */}
      <div>
        <p className="text-[13px] text-muted-foreground">
          <span className="tabular-nums">Step {step} of 3</span>
          <span aria-hidden> · </span>
          <span className="font-semibold text-foreground">{STEP_LABELS[step]}</span>
        </p>
        <div className="mt-2.5 grid grid-cols-3 gap-1.5" aria-hidden>
          {([1, 2, 3] as Step[]).map((s) => (
            <span key={s} className="h-1.5 overflow-hidden rounded-full bg-border">
              <span className={cn("block h-full origin-left rounded-full bg-brand transition-transform duration-500 ease-out", s <= step ? "scale-x-100" : "scale-x-0")} />
            </span>
          ))}
        </div>
      </div>

      <form onSubmit={(e) => e.preventDefault()} className="space-y-5">
        {/* Step 1: Account */}
        {step === 1 && (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" autoComplete="name" placeholder="John Doe" className={authField} {...fieldA11y("name", !!errors.name)} {...register("name")} />
              {errors.name && <FieldError id="name-error">{errors.name.message}</FieldError>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="signup-email">Email</Label>
              <Input id="signup-email" type="email" autoComplete="email" placeholder="you@example.com" className={authField} {...fieldA11y("email", !!errors.email)} {...register("email")} />
              {errors.email && <FieldError id="email-error">{errors.email.message}</FieldError>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="signup-password">Password</Label>
              <div className="relative">
                <Input
                  id="signup-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Create a password"
                  className={cn(authField, "pr-12")}
                  {...fieldA11y("password", !!errors.password)}
                  {...register("password")}
                />
                <RevealButton shown={showPassword} onToggle={() => setShowPassword(!showPassword)} />
              </div>
              {errors.password && <FieldError id="password-error">{errors.password.message}</FieldError>}
              <PasswordStrength password={password} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Confirm your password"
                  className={cn(authField, "pr-12")}
                  {...fieldA11y("confirmPassword", !!errors.confirmPassword)}
                  {...register("confirmPassword")}
                />
                <RevealButton shown={showConfirmPassword} onToggle={() => setShowConfirmPassword(!showConfirmPassword)} />
              </div>
              {errors.confirmPassword && <FieldError id="confirmPassword-error">{errors.confirmPassword.message}</FieldError>}
            </div>

            <div className="space-y-2">
              <div className="flex items-start gap-2.5">
                <Checkbox
                  id="terms"
                  className="mt-0.5"
                  checked={watch("agreeToTerms") as boolean}
                  {...fieldA11y("agreeToTerms", !!errors.agreeToTerms)}
                  onCheckedChange={(checked) => setValue("agreeToTerms", checked === true ? true : (false as unknown as true), { shouldValidate: true })}
                />
                <label htmlFor="terms" className="cursor-pointer text-[13px] leading-relaxed text-muted-foreground">
                  I agree to the{" "}
                  <Link href="/terms" target="_blank" rel="noopener noreferrer" className="font-medium text-foreground underline underline-offset-4">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="font-medium text-foreground underline underline-offset-4">
                    Privacy Policy
                  </Link>
                </label>
              </div>
              {errors.agreeToTerms && <FieldError id="agreeToTerms-error">{errors.agreeToTerms.message}</FieldError>}
            </div>

            <Button type="button" size="lg" className={cn(authAction, "w-full")} onClick={handleStep1Next}>
              Next <ArrowRight aria-hidden />
            </Button>
          </div>
        )}

        {/* Step 2: Details */}
        {step === 2 && (
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground">These details are optional. You can add them later.</p>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone number</Label>
              <div className="flex">
                <span className="flex items-center rounded-l-xl border border-r-0 border-input bg-muted px-4 text-[15px] text-muted-foreground tabular-nums">+91</span>
                <Input id="phone" type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="9876543210" className={cn(authField, "rounded-l-none")} {...fieldA11y("phone", !!errors.phone)} {...register("phone")} />
              </div>
              {errors.phone && <FieldError id="phone-error">{errors.phone.message}</FieldError>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="college">College / university</Label>
              <AutocompleteInput
                id="college"
                value={watch("collegeName") || ""}
                onChange={(v) => setValue("collegeName", v)}
                searchFn={searchColleges}
                className={authField}
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
                className={authField}
                placeholder="Start typing... e.g. Google, TCS"
              />
            </div>

            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:items-center">
              <Button type="button" variant="ghost" size="lg" className={cn(authAction, "sm:-ml-3")} onClick={() => setStep(1)}>
                <ArrowLeft aria-hidden /> Back
              </Button>
              <div className="flex gap-2 sm:ml-auto">
                <Button type="button" variant="outline" size="lg" className={cn(authAction, "flex-1 sm:flex-none sm:px-5")} onClick={handleStep2Next} disabled={isSubmitting}>
                  Skip
                </Button>
                <Button type="button" size="lg" className={cn(authAction, "flex-1 sm:flex-none sm:px-7")} onClick={handleStep2Next} disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Verify Email */}
        {step === 3 && (
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground">
              We&apos;ve sent a 6-digit code to <span className="font-medium text-foreground">{email}</span>
            </p>
            <CodeBoxes onComplete={handleVerifyOtp} disabled={isSubmitting} />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button type="button" variant="ghost" size="sm" className="-ml-3 tabular-nums" onClick={handleResendOtp} disabled={resendTimer > 0}>
                {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend code"}
              </Button>
              <Button type="button" variant="ghost" size="sm" className="-mr-3 text-muted-foreground" onClick={() => setStep(2)}>
                <ArrowLeft aria-hidden /> Go back
              </Button>
            </div>
          </div>
        )}
      </form>

      {step === 1 && (
        <div className="empty:hidden [&_button]:h-12">
          <SocialLoginButtons mode="signup" callbackUrl={callbackUrl} />
        </div>
      )}

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href={callbackUrl ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/login"}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Log in
        </Link>
      </p>
    </div>
  )
}
