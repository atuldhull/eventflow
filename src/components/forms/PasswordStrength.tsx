"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"
import { Check, X } from "lucide-react"

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

  const strength = useMemo(() => {
    const metCount = requirements.filter((r) => r.met).length
    if (metCount === 0) return { level: 0, label: "", color: "bg-muted" }
    if (metCount <= 2) return { level: 1, label: "Weak", color: "bg-red-500" }
    if (metCount <= 3) return { level: 2, label: "Fair", color: "bg-orange-500" }
    if (metCount <= 4) return { level: 3, label: "Good", color: "bg-yellow-500" }
    return { level: 4, label: "Strong", color: "bg-green-500" }
  }, [requirements])

  if (!password) return null

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Password strength</span>
          <span
            className={cn(
              "text-xs font-medium",
              strength.level <= 1 && "text-red-500",
              strength.level === 2 && "text-orange-500",
              strength.level === 3 && "text-yellow-500",
              strength.level === 4 && "text-green-500"
            )}
          >
            {strength.label}
          </span>
        </div>
        <div className="flex gap-1">
          {[1, 2, 3, 4].map((segment) => (
            <div
              key={segment}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                segment <= strength.level ? strength.color : "bg-muted"
              )}
            />
          ))}
        </div>
      </div>
      <ul className="space-y-1">
        {requirements.map((req) => (
          <li key={req.label} className="flex items-center gap-2">
            {req.met ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <X className="h-3.5 w-3.5 text-muted-foreground/50" />
            )}
            <span
              className={cn(
                "text-xs transition-colors",
                req.met ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {req.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
