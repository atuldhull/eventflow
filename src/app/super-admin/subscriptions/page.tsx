"use client"

import { useState, useEffect } from "react"
import { CreditCard, Loader2 } from "lucide-react"
import { PageHeader } from "@/components/shared/PageHeader"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const planMeta = [
  { key: "FREE", name: "Free", price: "₹0", color: "border-zinc-200" },
  { key: "STARTER", name: "Starter", price: "₹999", color: "border-blue-200" },
  { key: "PRO", name: "Pro", price: "₹2,999", color: "border-purple-200" },
  { key: "ENTERPRISE", name: "Enterprise", price: "Custom", color: "border-amber-200" },
]

const statusColors: Record<string, string> = { ACTIVE: "bg-green-100 text-green-700", TRIAL: "bg-blue-100 text-blue-700", PAST_DUE: "bg-red-100 text-red-700", CANCELLED: "bg-zinc-100 text-zinc-700" }

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

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>

  return (
    <div className="space-y-6">
      <PageHeader title="Subscriptions" description="Manage subscription plans and active subscriptions" breadcrumbs={[{ label: "Super Admin", href: "/super-admin" }, { label: "Subscriptions" }]} />

      <div>
        <h3 className="text-sm font-medium mb-3">Plan Distribution</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {planMeta.map((plan) => (
            <Card key={plan.key} className={`p-6 border-2 ${plan.color}`}>
              <h4 className="font-semibold">{plan.name}</h4>
              <p className="text-2xl font-bold mt-1">{plan.price}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
              <p className="text-sm text-muted-foreground mt-2">{planCounts[plan.key] || 0} subscribers</p>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-3">Paid Subscriptions</h3>
        {subscriptions.length > 0 ? (
          <div className="space-y-2">
            {subscriptions.map((sub) => (
              <Card key={sub.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">{sub.tenant}</p>
                    <p className="text-xs text-muted-foreground">{sub.plan} · {sub.interval}{sub.currentPeriodEnd ? ` · Renews ${new Date(sub.currentPeriodEnd).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className={statusColors[sub.status] || ""}>{sub.status}</Badge>
                    <span className="text-sm font-bold">₹{sub.price.toLocaleString("en-IN")}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-8 text-center text-muted-foreground">
            <CreditCard className="mx-auto h-10 w-10 mb-2 opacity-30" />
            <p className="font-medium">No paid subscriptions yet</p>
            <p className="text-sm">Subscriptions will appear when tenants subscribe to paid plans.</p>
          </Card>
        )}
      </div>
    </div>
  )
}
