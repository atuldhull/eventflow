"use client"

import { useState, useEffect } from "react"
import { AlertTriangle, Check, Loader2, Minus } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

import { PageHeader } from "@/components/shared/PageHeader"
import { Card } from "@/components/ui/card"
import { Button, buttonVariants } from "@/components/ui/button"
import { Pill } from "@/components/ui/pill"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { PLANS, ALL_PLAN_IDS, type PlanId, formatLimit, isUnlimited } from "@/config/plans"
import { useRBAC } from "@/hooks/useRBAC"
import { purchasePlan } from "@/lib/razorpay-checkout"
import { statusLabel, statusTone } from "@/lib/status-tone"
import { cn } from "@/lib/utils"
import { inr } from "../_components/admin-ui"

interface UsageItem { used: number; limit: number; percentage: number; remaining: number; resetsOn?: string }
interface BillingData {
  subscription: { plan: string; status: string; interval: string; price: number; currentPeriodEnd: string; trialEndsAt: string | null; cancelledAt: string | null }
  usage: Record<string, UsageItem>
  features: Record<string, boolean>
  alerts: { limit: string; percentage: number; message: string; severity: string }[]
  planDetails: { name: string; description: string }
}

const usageLabels: Record<string, string> = {
  eventsThisMonth: "Events this month",
  organizations: "Organizations",
  teamMembers: "Team members",
  certificateTemplates: "Certificate templates",
  webhooks: "Webhooks",
}

/** Subscription statuses use the shared tones; a trial reads as information. */
const subscriptionTone = (status: string) => statusTone(status === "TRIAL" ? "trialing" : status)

function featureLabel(key: string) {
  const words = key.replace(/([A-Z])/g, " $1").trim().toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export default function EnterpriseBillingPage() {
  const { currentEnterpriseId } = useRBAC()
  const [billing, setBilling] = useState<BillingData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showPlans, setShowPlans] = useState(false)
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">("monthly")
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)

  useEffect(() => {
    if (!currentEnterpriseId) return
    async function fetchBilling() {
      try {
        const res = await fetch(`/api/admin/billing?entityType=enterprise&entityId=${currentEnterpriseId}`)
        const data = await res.json()
        if (data.success) setBilling(data.data)
      } catch {} finally { setIsLoading(false) }
    }
    fetchBilling()
  }, [currentEnterpriseId])

  const handleUpgrade = async (plan: PlanId) => {
    if (!currentEnterpriseId) return
    try {
      // Paid plans open Razorpay Checkout and are activated only after server-side verification.
      const result = await purchasePlan({
        plan,
        billingInterval: billingInterval === "yearly" ? "YEARLY" : "MONTHLY",
        entityType: "enterprise",
        entityId: currentEnterpriseId,
      })
      if (result.success) { toast.success(result.message); window.location.reload() }
      else if (!result.cancelled) toast.error(result.message)
    } catch { toast.error("Failed to change plan") }
  }

  const handleCancel = async () => {
    if (!currentEnterpriseId) return
    setIsCancelling(true)
    try {
      const res = await fetch("/api/admin/billing/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType: "enterprise", entityId: currentEnterpriseId }),
      })
      const data = await res.json()
      if (data.success) { toast.success(data.message); window.location.reload() }
      else toast.error(data.message)
    } catch { toast.error("Failed to cancel") } finally { setIsCancelling(false) }
  }

  if (isLoading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading billing">
        <div className="space-y-2"><Skeleton className="h-7 w-40" /><Skeleton className="h-4 w-64" /></div>
        <Card className="p-5"><Skeleton className="h-5 w-32" /><Skeleton className="mt-3 h-8 w-28" /><Skeleton className="mt-3 h-4 w-48" /></Card>
        <Card className="p-5"><Skeleton className="h-4 w-24" /><div className="mt-4 grid gap-5 sm:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}</div></Card>
      </div>
    )
  }

  const currentPlan = (billing?.subscription?.plan || "FREE") as PlanId
  const subStatus = billing?.subscription?.status || "ACTIVE"
  const canCancel = currentPlan !== "FREE" && !billing?.subscription?.cancelledAt

  return (
    <div className="space-y-6">
      <PageHeader title="Billing" description="Your plan, usage and payments" />

      {/* Alerts */}
      {billing?.alerts && billing.alerts.length > 0 && (
        <ul className="space-y-2">
          {billing.alerts.map((alert) => (
            <li
              key={alert.limit}
              role="status"
              className={cn(
                "flex items-start gap-2.5 rounded-lg px-4 py-3 text-sm",
                alert.severity === "critical" ? "bg-pill-negative text-pill-negative-foreground" : "bg-pill-warning text-pill-warning-foreground",
              )}
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{alert.message}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Current plan */}
      <Card className="gap-0 p-0">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold">{PLANS[currentPlan].name} plan</h2>
              <Pill tone={subscriptionTone(subStatus)}>{statusLabel(subStatus)}</Pill>
            </div>
            <p className="text-sm text-muted-foreground">{PLANS[currentPlan].description}</p>
            {billing?.subscription?.price !== undefined && (
              <p className="pt-2 text-[28px] leading-8 tracking-[-0.02em] tabular-nums">
                {inr(billing.subscription.price)}
                <span className="ml-1 text-sm tracking-normal text-muted-foreground">
                  /{billing.subscription.interval?.toLowerCase() === "yearly" ? "year" : "month"}
                </span>
              </p>
            )}
            {billing?.subscription?.currentPeriodEnd && (
              <p className="text-[13px] text-muted-foreground tabular-nums">
                Next billing on {new Date(billing.subscription.currentPeriodEnd).toLocaleDateString("en-IN")}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2 max-sm:[&>*]:flex-1">
            {canCancel && (
              <Button variant="ghost" className="text-destructive hover:bg-pill-negative hover:text-destructive" onClick={() => setConfirmCancel(true)}>
                Cancel plan
              </Button>
            )}
            <Button variant="outline" aria-expanded={showPlans} aria-controls="plan-picker" onClick={() => setShowPlans(!showPlans)}>
              {showPlans ? "Hide plans" : "Change plan"}
            </Button>
          </div>
        </div>

        {/* Plan selection */}
        {showPlans && (
          <div id="plan-picker" className="border-t border-rule p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-[15px] font-semibold">Choose a plan</h3>
              <div role="group" aria-label="Billing interval" className="inline-flex w-fit rounded-md border bg-raised p-0.5 text-[13px]">
                {(["monthly", "yearly"] as const).map((interval) => (
                  <button
                    key={interval}
                    type="button"
                    aria-pressed={billingInterval === interval}
                    onClick={() => setBillingInterval(interval)}
                    className={cn(
                      "h-8 rounded-[5px] px-3 font-medium transition-colors pointer-coarse:h-10",
                      billingInterval === interval ? "bg-background text-foreground shadow-[0_0_0_1px_var(--border)]" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {interval === "monthly" ? "Monthly" : <>Yearly <span className="font-normal text-brand">save 17%</span></>}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {ALL_PLAN_IDS.map((planId) => {
                const plan = PLANS[planId]
                const isCurrent = planId === currentPlan
                const price = plan.price[billingInterval]
                const isUpgrade = ALL_PLAN_IDS.indexOf(planId) > ALL_PLAN_IDS.indexOf(currentPlan)
                return (
                  <div
                    key={planId}
                    className={cn(
                      "flex flex-col rounded-lg border p-4",
                      isCurrent && "border-brand ring-1 ring-brand",
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{plan.name}</p>
                      {isCurrent ? <Pill tone="brand">Current</Pill> : plan.badge ? <Pill>{plan.badge}</Pill> : null}
                    </div>
                    <p className="mt-2 text-[22px] leading-7 tracking-[-0.015em] tabular-nums">
                      {price ? inr(price) : "Custom"}
                      {price ? <span className="ml-0.5 text-[13px] tracking-normal text-muted-foreground">/{billingInterval === "yearly" ? "yr" : "mo"}</span> : null}
                    </p>
                    <ul className="mt-3 mb-4 space-y-1.5 text-[13px] text-muted-foreground tabular-nums">
                      <li>{formatLimit(plan.limits.maxEventsPerMonth)} events/mo</li>
                      <li>{formatLimit(plan.limits.maxParticipantsPerEvent)} participants/event</li>
                      <li>{formatLimit(plan.limits.maxOrganizations)} organizations</li>
                      <li>{formatLimit(plan.limits.maxTeamMembers)} team members</li>
                    </ul>
                    <div className="mt-auto">
                      {isCurrent ? (
                        <Button variant="outline" disabled className="w-full">Current plan</Button>
                      ) : planId === "ENTERPRISE" ? (
                        <Link href="/contact" className={cn(buttonVariants({ variant: "outline" }), "w-full")}>Contact sales</Link>
                      ) : (
                        <Button
                          variant={isUpgrade && plan.isPopular ? "default" : "outline"}
                          onClick={() => handleUpgrade(planId)}
                          className="w-full"
                        >
                          {isUpgrade ? "Upgrade" : "Downgrade"}
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </Card>

      {/* Usage */}
      <section aria-labelledby="usage-heading">
        <h2 id="usage-heading" className="mb-2 text-[15px] font-semibold">Usage</h2>
        <Card className="gap-0 p-0">
          {billing?.usage && Object.keys(billing.usage).length > 0 ? (
            <ul className="grid gap-x-10 gap-y-5 p-5 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(billing.usage).map(([key, item]) => {
                const label = usageLabels[key] || key
                return (
                  <li key={key} className="space-y-2">
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span>{label}</span>
                      <span className="text-muted-foreground tabular-nums">
                        <span className="text-foreground">{item.used}</span> / {isUnlimited(item.limit) ? "∞" : item.limit}
                      </span>
                    </div>
                    <div
                      className="h-1.5 overflow-hidden rounded-full bg-muted"
                      role="progressbar"
                      aria-label={label}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.min(item.percentage, 100)}
                    >
                      <div
                        className={cn(
                          "h-full rounded-full transition-[width]",
                          item.percentage >= 90 ? "bg-destructive" : item.percentage >= 70 ? "bg-warning" : "bg-brand",
                        )}
                        style={{ width: `${Math.min(item.percentage, 100)}%` }}
                      />
                    </div>
                    {item.resetsOn && (
                      <p className="text-xs text-muted-foreground">
                        Resets on {item.resetsOn}. Cancelled and deleted events don&apos;t count.
                      </p>
                    )}
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="px-5 py-6 text-sm text-muted-foreground">No usage recorded yet.</p>
          )}
        </Card>
      </section>

      {/* Features */}
      <section aria-labelledby="features-heading">
        <h2 id="features-heading" className="mb-2 text-[15px] font-semibold">Included features</h2>
        <Card className="p-5">
          <ul className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {billing?.features && Object.entries(billing.features).map(([feature, enabled]) => (
              <li key={feature} className="flex items-center gap-2 text-sm">
                {enabled ? (
                  <Check className="size-4 shrink-0 text-brand" aria-label="Included" />
                ) : (
                  <Minus className="size-4 shrink-0 text-faint" aria-label="Not included" />
                )}
                <span className={cn(!enabled && "text-muted-foreground")}>{featureLabel(feature)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      {/* Billing history */}
      <section aria-labelledby="history-heading">
        <h2 id="history-heading" className="mb-2 text-[15px] font-semibold">Billing history</h2>
        <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          {currentPlan === "FREE" ? "No billing history on the Free plan." : "Invoices will appear here after your first payment."}
        </p>
      </section>

      <Dialog open={confirmCancel} onOpenChange={(open) => !open && !isCancelling && setConfirmCancel(false)}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Cancel the {PLANS[currentPlan].name} plan?</DialogTitle>
            <DialogDescription>
              Your enterprise keeps its current features until the end of the billing period.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmCancel(false)} disabled={isCancelling}>Keep plan</Button>
            <Button variant="destructive" onClick={handleCancel} disabled={isCancelling}>
              {isCancelling && <Loader2 className="animate-spin" />}
              Cancel plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
