"use client"

import { useState, useEffect } from "react"
import { CreditCard } from "lucide-react"
import { PageHeader } from "@/components/shared/PageHeader"
import { KpiStrip } from "@/components/shared/StatCard"
import { EmptyState } from "@/components/shared/EmptyState"
import { Pill } from "@/components/ui/pill"
import { Skeleton } from "@/components/ui/skeleton"
import { statusLabel, statusTone } from "@/lib/status-tone"
import { fmtDate, inr, num } from "@/app/admin/enterprise/_components/admin-ui"

const planMeta = [
  { key: "FREE", name: "Free", price: "₹0" },
  { key: "STARTER", name: "Starter (legacy)", price: "₹999" },
  { key: "PRO", name: "Pro", price: "₹999" },
  { key: "ENTERPRISE", name: "Enterprise", price: "Custom" },
]

/** Subscription statuses use the shared tones; a trial reads as information. */
const subscriptionTone = (status: string) => statusTone(status === "TRIAL" ? "trialing" : status)

interface Sub { id: string; plan: string; status: string; interval: string; price: number; tenant: string; currentPeriodEnd: string | null; createdAt: string }

export default function SubscriptionsPage() {
  const [planCounts, setPlanCounts] = useState<Record<string, number>>({})
  const [subscriptions, setSubscriptions] = useState<Sub[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetch_() {
      try {
        const res = await fetch("/api/super-admin/subscriptions")
        const json = await res.json()
        if (json.success) { setPlanCounts(json.data.planCounts); setSubscriptions(json.data.subscriptions) }
      } catch {} finally { setIsLoading(false) }
    }
    fetch_()
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader title="Subscriptions" description="Plans and the tenants paying for them" />

      <section aria-labelledby="plans-heading">
        <h2 id="plans-heading" className="mb-2 text-[15px] font-semibold">Subscribers by plan</h2>
        <KpiStrip
          isLoading={isLoading}
          items={planMeta.map((plan) => ({
            label: plan.name,
            value: num(planCounts[plan.key] || 0),
            caption: plan.price === "Custom" ? "Custom pricing" : `${plan.price}/mo`,
          }))}
        />
      </section>

      <section aria-labelledby="paid-heading">
        <h2 id="paid-heading" className="mb-2 text-[15px] font-semibold">Paid subscriptions</h2>
        {isLoading ? (
          <div className="space-y-2" aria-busy="true" aria-label="Loading subscriptions">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
          </div>
        ) : subscriptions.length > 0 ? (
          <div className="overflow-hidden rounded-lg border">
            <div className="hidden grid-cols-[minmax(0,1fr)_120px_120px_110px] gap-4 border-b border-border bg-raised px-4 py-2.5 text-xs font-medium text-muted-foreground sm:grid">
              <span>Tenant</span>
              <span>Renews</span>
              <span>Status</span>
              <span className="text-right">Price</span>
            </div>
            <ul className="divide-y divide-rule">
              {subscriptions.map((sub) => (
                <li
                  key={sub.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_120px_120px_110px]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{sub.tenant}</p>
                    <p className="text-[13px] text-muted-foreground">{statusLabel(sub.plan)} · {statusLabel(sub.interval)}</p>
                  </div>
                  <p className="order-3 text-[13px] text-muted-foreground tabular-nums sm:order-none sm:text-sm">
                    {sub.currentPeriodEnd ? <><span className="sm:hidden">Renews </span>{fmtDate(sub.currentPeriodEnd)}</> : "—"}
                  </p>
                  <div className="order-4 justify-self-end sm:order-none sm:justify-self-start">
                    <Pill tone={subscriptionTone(sub.status)}>{statusLabel(sub.status)}</Pill>
                  </div>
                  <p className="order-2 text-right text-sm font-medium tabular-nums sm:order-none">{inr(sub.price)}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <EmptyState
            icon={CreditCard}
            title="No paid subscriptions yet"
            description="Subscriptions will appear when tenants subscribe to paid plans."
          />
        )}
      </section>
    </div>
  )
}
