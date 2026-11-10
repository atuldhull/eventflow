"use client"

import { useEffect, useState } from "react"
import { CreditCard, Loader2, Zap } from "lucide-react"
import { toast } from "sonner"
import { PageHeader } from "@/components/shared/PageHeader"
import { EmptyState } from "@/components/shared/EmptyState"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Pill } from "@/components/ui/pill"
import { Skeleton } from "@/components/ui/skeleton"
import { statusLabel, statusTone } from "@/lib/status-tone"
import { useRBAC } from "@/hooks/useRBAC"
import { cn } from "@/lib/utils"
import { PLANS, getNextPlan, type PlanId } from "@/config/plans"
import { purchasePlan } from "@/lib/razorpay-checkout"

interface UsageItem {
  key: string
  label: string
  used: number
  limit: number
  note?: string
  /** the limit is reached: the next event can't be created */
  blocked?: boolean
  /** what creating an event answers while blocked, with how to get more room */
  message?: string
}

export default function OrgBillingPage() {
  const { accessibleOrganizations, currentOrganizationId } = useRBAC()
  const org = accessibleOrganizations.find((o) => o.id === currentOrganizationId)
  const isStandalone = !org?.enterpriseId
  const [subscription, setSubscription] = useState<{ plan: string; price: number; interval: string; status?: string } | null>(null)
  const [usage, setUsage] = useState<UsageItem[] | null>(null)
  const [usageError, setUsageError] = useState<string | null>(null)
  const [isUpgrading, setIsUpgrading] = useState(false)

  useEffect(() => {
    if (!currentOrganizationId) return
    async function fetchBilling() {
      try {
        const res = await fetch(`/api/admin/billing?entityType=org&entityId=${currentOrganizationId}`)
        const data = await res.json()
        if (data.success) setSubscription(data.data.subscription)
      } catch {}
    }
    // Usage is shown to every organization: an enterprise organization sees the
    // enterprise's plan and its shared event count, the figures its event limit uses.
    async function fetchUsage() {
      try {
        const res = await fetch(`/api/admin/org/${currentOrganizationId}/billing/usage`)
        const data = await res.json()
        if (data.success) setUsage(data.data.usage)
        else setUsageError(data.message || "Usage isn't available right now")
      } catch {
        setUsageError("Usage isn't available right now")
      }
    }
    if (isStandalone) fetchBilling()
    fetchUsage()
  }, [currentOrganizationId, isStandalone])

  const currentPlan = (subscription?.plan && subscription.plan in PLANS ? subscription.plan : "FREE") as PlanId
  const nextPlan = getNextPlan(currentPlan)
  // ENTERPRISE is custom-priced (contact sales), so only STARTER/PRO are self-serve upgrades.
  const upgradeTo = nextPlan && PLANS[nextPlan].price.monthly > 0 ? nextPlan : null

  const handleUpgrade = async () => {
    if (!currentOrganizationId || !upgradeTo) return
    setIsUpgrading(true)
    try {
      // Paid plans open Razorpay Checkout and are activated only after server-side verification.
      const result = await purchasePlan({ plan: upgradeTo, billingInterval: "MONTHLY", entityType: "org", entityId: currentOrganizationId })
      if (result.success) { toast.success(result.message); window.location.reload() }
      else if (!result.cancelled) toast.error(result.message)
    } catch {
      toast.error("Failed to change plan")
    } finally {
      setIsUpgrading(false)
    }
  }

  if (!isStandalone) {
    return (
      <div className="max-w-3xl space-y-6">
        <PageHeader title="Billing" />
        <EmptyState
          icon={CreditCard}
          title="Billing is managed by your enterprise"
          description="Your organization uses the enterprise's plan. Contact your enterprise admin to upgrade it."
        />
        <UsageSection usage={usage} usageError={usageError} description="Your enterprise's plan, shared by all of its organizations." />
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Billing" description="Your subscription plan and limits" />

      <Card className="gap-0 p-0">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-[13px] text-muted-foreground">Current plan</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h2 className="text-[22px] leading-7 font-semibold tracking-[-0.015em]">{PLANS[currentPlan].name}</h2>
              <Pill tone={statusTone(subscription?.status ?? "ACTIVE")}>{statusLabel(subscription?.status ?? "ACTIVE")}</Pill>
            </div>
            <p className="mt-3 text-[28px] leading-8 tracking-[-0.02em] tabular-nums">
              ₹{(subscription?.price ?? 0).toLocaleString("en-IN")}
              <span className="ml-1 text-sm tracking-normal text-muted-foreground">/ {subscription?.interval === "YEARLY" ? "year" : "month"}</span>
            </p>
          </div>
          <Button onClick={handleUpgrade} disabled={!upgradeTo || isUpgrading} className="max-sm:w-full">
            {isUpgrading ? <Loader2 className="animate-spin" /> : <Zap />} Upgrade{upgradeTo ? ` to ${PLANS[upgradeTo].name}` : ""}
          </Button>
        </div>
        <p className="border-t border-rule bg-raised px-5 py-3 text-[13px] text-muted-foreground">
          Paid plans are charged through Razorpay and switch on once the payment is verified.
        </p>
      </Card>

      <UsageSection usage={usage} usageError={usageError} description="What you use now against what your plan includes." />
    </div>
  )
}

function UsageSection({ usage, usageError, description }: { usage: UsageItem[] | null; usageError: string | null; description: string }) {
  return (
      <section aria-labelledby="usage-heading" className="grid gap-4 border-t border-rule pt-6 md:grid-cols-[200px_minmax(0,1fr)] md:gap-10">
        <div>
          <h2 id="usage-heading" className="text-[15px] font-semibold">Usage and limits</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>
        </div>
        {usageError ? (
          <p role="alert" className="rounded-lg border px-4 py-3 text-[13px] text-muted-foreground">{usageError}</p>
        ) : !usage ? (
          <div className="space-y-2" aria-busy="true" aria-label="Loading usage">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
          </div>
        ) : (
          <ul className="divide-y divide-rule rounded-lg border">
            {usage.map((item) => {
              const unlimited = item.limit < 0
              const share = unlimited || item.limit === 0 ? 0 : Math.min(1, item.used / item.limit)
              const full = !unlimited && item.used >= item.limit
              return (
                <li key={item.key} className="px-4 py-3">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span>{item.label}</span>
                    <span className={cn("tabular-nums", full ? "font-medium text-destructive" : "text-muted-foreground")}>
                      {item.used.toLocaleString("en-IN")} / {unlimited ? "Unlimited" : item.limit.toLocaleString("en-IN")}
                    </span>
                  </div>
                  {!unlimited && (
                    <div
                      className="mt-2 h-1.5 overflow-hidden rounded-[2px] bg-muted"
                      role="progressbar"
                      aria-label={item.label}
                      aria-valuemin={0}
                      aria-valuemax={item.limit}
                      aria-valuenow={Math.min(item.used, item.limit)}
                    >
                      <div className={cn("h-full rounded-[2px]", full ? "bg-destructive" : share >= 0.8 ? "bg-warning" : "bg-brand")} style={{ width: `${share * 100}%` }} />
                    </div>
                  )}
                  {item.note && <p className="mt-1.5 text-xs text-muted-foreground">{item.note}</p>}
                  {item.blocked && item.message && (
                    <p role="status" className="mt-2 rounded-md bg-pill-negative px-3 py-2 text-[13px] text-pill-negative-foreground">{item.message}</p>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
  )
}
