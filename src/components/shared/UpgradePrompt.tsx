"use client"

import { useRouter } from "next/navigation"
import { AlertTriangle, Zap, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { PLAN_CONFIG, type PlanName, getUpgradePrompt } from "@/lib/subscription"

interface UpgradePromptProps {
  feature: string
  currentPlan: PlanName
  currentUsage: number
  limit: number
  onDismiss?: () => void
  variant?: "inline" | "modal"
}

export function UpgradePrompt({
  feature,
  currentPlan,
  currentUsage,
  limit,
  onDismiss,
  variant = "inline",
}: UpgradePromptProps) {
  const router = useRouter()
  const upgradeMessage = getUpgradePrompt(feature, currentPlan)

  return (
    <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="flex-1 space-y-2">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
            You&apos;ve reached your {feature} limit
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Your {currentPlan} plan allows {limit === -1 ? "unlimited" : limit} {feature}.
            You&apos;ve used {currentUsage}. {upgradeMessage}
          </p>
          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => router.push("/pricing")}
            >
              <Zap className="h-3.5 w-3.5" />
              Upgrade Plan
            </Button>
            {onDismiss && (
              <Button variant="ghost" size="sm" onClick={onDismiss}>
                Dismiss
              </Button>
            )}
          </div>
        </div>
        {onDismiss && variant === "inline" && (
          <button onClick={onDismiss} className="text-amber-500 hover:text-amber-700">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </Card>
  )
}
