"use client"

import { useState, useEffect } from "react"
import { CreditCard, Zap, AlertTriangle, CheckCircle, Clock, Download, ArrowUpRight, ArrowDownRight } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

import { PageHeader } from "@/components/shared/PageHeader"
import { Card } from "@/components/ui/card"
import { Button, buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PLANS, ALL_PLAN_IDS, type PlanId, formatLimit, isUnlimited, getYearlySavings } from "@/config/plans"
import { useRBAC } from "@/hooks/useRBAC"
import { cn } from "@/lib/utils"

interface UsageItem { used: number; limit: number; percentage: number; remaining: number }
interface BillingData {
  subscription: { plan: string; status: string; interval: string; price: number; currentPeriodEnd: string; trialEndsAt: string | null; cancelledAt: string | null }
  usage: Record<string, UsageItem>
  features: Record<string, boolean>
  alerts: { limit: string; percentage: number; message: string; severity: string }[]
  planDetails: { name: string; description: string }
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  ACTIVE: { label: "Active", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", icon: CheckCircle },
  TRIAL: { label: "Trial", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", icon: Clock },
  PAST_DUE: { label: "Past Due", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", icon: AlertTriangle },
  CANCELLED: { label: "Cancelled", color: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300", icon: AlertTriangle },
}

const usageLabels: Record<string, string> = {
  eventsThisMonth: "Events This Month",
  organizations: "Organizations",
  teamMembers: "Team Members",
  certificateTemplates: "Certificate Templates",
  webhooks: "Webhooks",
}

export default function EnterpriseBillingPage() {
  const { currentEnterpriseId } = useRBAC()
  const [billing, setBilling] = useState<BillingData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showPlans, setShowPlans] = useState(false)
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">("monthly")

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
      const res = await fetch("/api/admin/billing/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, billingInterval, entityType: "enterprise", entityId: currentEnterpriseId }),
      })
      const data = await res.json()
      if (data.success) { toast.success("Plan updated!"); window.location.reload() }
      else toast.error(data.message)
    } catch { toast.error("Failed to change plan") }
  }

  const handleCancel = async () => {
    if (!currentEnterpriseId) return
    try {
      const res = await fetch("/api/admin/billing/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType: "enterprise", entityId: currentEnterpriseId }),
      })
      const data = await res.json()
      if (data.success) { toast.success(data.message); window.location.reload() }
      else toast.error(data.message)
    } catch { toast.error("Failed to cancel") }
  }

  if (isLoading) return <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" /></div>

  const currentPlan = (billing?.subscription?.plan || "FREE") as PlanId
  const status = statusConfig[billing?.subscription?.status || "ACTIVE"] || statusConfig.ACTIVE
  const StatusIcon = status.icon

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing & Subscription"
        description="Manage your plan and payments"
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Enterprise", href: "/admin/enterprise" }, { label: "Billing" }]}
      />

      {/* Alerts */}
      {billing?.alerts && billing.alerts.length > 0 && (
        <div className="space-y-2">
          {billing.alerts.map((alert) => (
            <div key={alert.limit} className={cn("rounded-lg p-3 text-sm flex items-center gap-2",
              alert.severity === "critical" ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400" :
              alert.severity === "danger" ? "bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400" :
              "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
            )}>
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{alert.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Current Plan */}
      <Card className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold">{PLANS[currentPlan].name} Plan</h3>
              <Badge variant="secondary" className={status.color}><StatusIcon className="h-3 w-3 mr-1" />{status.label}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{PLANS[currentPlan].description}</p>
            {billing?.subscription?.price !== undefined && (
              <p className="text-2xl font-bold">
                ₹{billing.subscription.price.toLocaleString("en-IN")}
                <span className="text-sm font-normal text-muted-foreground">/{billing.subscription.interval?.toLowerCase() === "yearly" ? "year" : "month"}</span>
              </p>
            )}
            {billing?.subscription?.currentPeriodEnd && (
              <p className="text-xs text-muted-foreground">
                Next billing: {new Date(billing.subscription.currentPeriodEnd).toLocaleDateString("en-IN")}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowPlans(!showPlans)}>
              {showPlans ? "Hide Plans" : "Change Plan"}
            </Button>
            {currentPlan !== "FREE" && !billing?.subscription?.cancelledAt && (
              <Button variant="ghost" className="text-destructive" onClick={handleCancel}>Cancel</Button>
            )}
          </div>
        </div>
      </Card>

      {/* Plan Selection */}
      {showPlans && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Choose a Plan</h3>
            <div className="flex items-center gap-2 text-sm">
              <button onClick={() => setBillingInterval("monthly")} className={cn("px-3 py-1 rounded-md", billingInterval === "monthly" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>Monthly</button>
              <button onClick={() => setBillingInterval("yearly")} className={cn("px-3 py-1 rounded-md", billingInterval === "yearly" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>Yearly <span className="text-xs">(Save 17%)</span></button>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-4">
            {ALL_PLAN_IDS.map((planId) => {
              const plan = PLANS[planId]
              const isCurrent = planId === currentPlan
              const price = plan.price[billingInterval]
              return (
                <Card key={planId} className={cn("p-4 space-y-3 relative", isCurrent && "border-primary", plan.isPopular && "shadow-md")}>
                  {plan.badge && <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 text-[10px]">{plan.badge}</Badge>}
                  <div>
                    <p className="font-semibold">{plan.name}</p>
                    <p className="text-xl font-bold mt-1">
                      {price ? `₹${price.toLocaleString("en-IN")}` : "Custom"}
                      {price ? <span className="text-xs font-normal text-muted-foreground">/{billingInterval === "yearly" ? "yr" : "mo"}</span> : null}
                    </p>
                  </div>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    <li>{formatLimit(plan.limits.maxEventsPerMonth)} events/mo</li>
                    <li>{formatLimit(plan.limits.maxParticipantsPerEvent)} participants/event</li>
                    <li>{formatLimit(plan.limits.maxOrganizations)} organizations</li>
                    <li>{formatLimit(plan.limits.maxTeamMembers)} team members</li>
                  </ul>
                  {isCurrent ? (
                    <Button variant="outline" disabled className="w-full text-xs">Current Plan</Button>
                  ) : planId === "ENTERPRISE" ? (
                    <Link href="/contact" className={cn(buttonVariants({ variant: "outline" }), "w-full text-xs")}>Contact Sales</Link>
                  ) : (
                    <Button onClick={() => handleUpgrade(planId)} className="w-full text-xs">
                      {ALL_PLAN_IDS.indexOf(planId) > ALL_PLAN_IDS.indexOf(currentPlan) ? "Upgrade" : "Downgrade"}
                    </Button>
                  )}
                </Card>
              )
            })}
          </div>
        </Card>
      )}

      {/* Usage Dashboard */}
      <Card className="p-6 space-y-4">
        <h3 className="font-semibold">Usage</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {billing?.usage && Object.entries(billing.usage).map(([key, item]) => (
            <div key={key} className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span>{usageLabels[key] || key}</span>
                <span className="text-muted-foreground">
                  {item.used} / {isUnlimited(item.limit) ? "∞" : item.limit}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all",
                    item.percentage >= 90 ? "bg-red-500" : item.percentage >= 70 ? "bg-amber-500" : "bg-green-500"
                  )}
                  style={{ width: `${Math.min(item.percentage, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Features */}
      <Card className="p-6 space-y-4">
        <h3 className="font-semibold">Features</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {billing?.features && Object.entries(billing.features).map(([feature, enabled]) => (
            <div key={feature} className="flex items-center gap-2 text-sm">
              {enabled ? <CheckCircle className="h-4 w-4 text-green-500" /> : <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />}
              <span className={cn(!enabled && "text-muted-foreground")}>{feature.replace(/([A-Z])/g, " $1").trim()}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Billing History */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Billing History</h3>
        <p className="text-sm text-muted-foreground text-center py-8">
          {currentPlan === "FREE" ? "No billing history on the Free plan." : "Invoices will appear here after your first payment."}
        </p>
      </Card>
    </div>
  )
}
