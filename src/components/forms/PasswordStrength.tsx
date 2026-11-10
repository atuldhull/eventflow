"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"
import { Check, Minus } from "lucide-react"

interface PasswordStrengthProps {
  password: string
}

interface Requirement {
  label: string
  met: boolean
}

export function PasswordStrength({ password }: PasswordStrengthProps) {
  const requirements: Requirement[] = useMemo(
    () => [
      { label: "At least 8 characters", met: password.length >= 8 },
      { label: "One uppercase letter", met: /[A-Z]/.test(password) },
      { label: "One lowercase letter", met: /[a-z]/.test(password) },
      { label: "One number", met: /[0-9]/.test(password) },
      { label: "One special character", met: /[^A-Za-z0-9]/.test(password) },
    ],
    [password]
  )

  // Same scoring as before; only the colours moved to the status tokens
  const strength = useMemo(() => {
    const metCount = requirements.filter((r) => r.met).length
    if (metCount === 0) return { level: 0, label: "", bar: "bg-muted", text: "" }
    if (metCount <= 2) return { level: 1, label: "Weak", bar: "bg-destructive", text: "text-destructive" }
    if (metCount <= 3) return { level: 2, label: "Fair", bar: "bg-warning", text: "text-warning" }
    if (metCount <= 4) return { level: 3, label: "Good", bar: "bg-positive/70", text: "text-positive" }
    return { level: 4, label: "Strong", bar: "bg-positive", text: "text-positive" }
  }, [requirements])

  if (!password) return null

  return (
    <div className="space-y-3 pt-1">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Password strength</span>
          <span className={cn("text-xs font-medium", strength.text)} aria-live="polite">
            {strength.label}
          </span>
        </div>
        <div className="flex gap-1" aria-hidden>
          {[1, 2, 3, 4].map((segment) => (
            <div
              key={segment}
              className={cn("h-1 flex-1 rounded-full transition-colors", segment <= strength.level ? strength.bar : "bg-muted")}
            />
          ))}
        </div>
      </div>
      <ul className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
        {requirements.map((req) => (
          <li key={req.label} className="flex items-center gap-2">
            {req.met ? (
              <Check className="size-3.5 shrink-0 text-positive" aria-hidden />
            ) : (
              <Minus className="size-3.5 shrink-0 text-faint" aria-hidden />
            )}
            <span className={cn("text-xs transition-colors", req.met ? "text-foreground" : "text-muted-foreground")}>
              {req.label}
              <span className="sr-only">{req.met ? " (met)" : " (not met)"}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
