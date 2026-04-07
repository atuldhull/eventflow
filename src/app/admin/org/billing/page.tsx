"use client"

import { CreditCard, Zap } from "lucide-react"
import { PageHeader } from "@/components/shared/PageHeader"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useRBAC } from "@/hooks/useRBAC"

export default function OrgBillingPage() {
  const { accessibleOrganizations, currentOrganizationId } = useRBAC()
  const org = accessibleOrganizations.find((o) => o.id === currentOrganizationId)
  const isStandalone = !org?.enterpriseId

  if (!isStandalone) {
    return (
      <div className="space-y-6">
        <PageHeader title="Billing" breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Organization", href: "/admin/org" }, { label: "Billing" }]} />
        <Card className="p-8 text-center">
          <CreditCard className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="font-medium">Billing is managed by your enterprise</p>
          <p className="text-sm text-muted-foreground mt-1">Contact your enterprise admin for billing inquiries.</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Billing & Subscription" description="Manage your subscription plan" breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Organization", href: "/admin/org" }, { label: "Billing" }]} />
      <Card className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2"><h3 className="text-lg font-semibold">Free Plan</h3><Badge>Active</Badge></div>
            <p className="text-2xl font-bold mt-2">₹0<span className="text-sm font-normal text-muted-foreground">/month</span></p>
          </div>
          <Button className="gap-2"><Zap className="h-4 w-4" /> Upgrade</Button>
        </div>
      </Card>
      <Card className="p-6 space-y-4">
        <h3 className="text-sm font-medium">Usage & Limits</h3>
        {[{ label: "Events", used: 0, limit: 5 }, { label: "Participants per event", used: 0, limit: 100 }, { label: "Team members", used: 0, limit: 5 }].map((item) => (
          <div key={item.label} className="space-y-1">
            <div className="flex justify-between text-sm"><span>{item.label}</span><span className="text-muted-foreground">{item.used} / {item.limit}</span></div>
            <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full bg-primary" style={{ width: `${(item.used / item.limit) * 100}%` }} /></div>
          </div>
        ))}
      </Card>
    </div>
  )
}
