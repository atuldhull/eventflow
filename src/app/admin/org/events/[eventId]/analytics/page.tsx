"use client"

import { use, useState, useEffect } from "react"
import { Eye, Users, ClipboardList, IndianRupee, QrCode, Star, Download, Loader2 } from "lucide-react"

import { PageHeader } from "@/components/shared/PageHeader"
import { StatCard } from "@/components/shared/StatCard"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/permissions"
import { useRBAC } from "@/hooks/useRBAC"

export default function EventAnalyticsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params)
  const { currentOrganizationId } = useRBAC()
  const [data, setData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!currentOrganizationId) return
    async function fetchAnalytics() {
      try {
        const res = await fetch(`/api/admin/org/${currentOrganizationId}/events/${eventId}/analytics`)
        const json = await res.json()
        if (json.success) setData(json.data)
      } catch {} finally { setIsLoading(false) }
    }
    fetchAnalytics()
  }, [currentOrganizationId, eventId])

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>

  const stats = data || { registrations: 0, confirmed: 0, checkedIn: 0, revenue: 0, rating: 0 }

  return (
    <div className="space-y-6">
      <PageHeader title="Event Analytics" description="Detailed performance metrics"
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Events", href: "/admin/org/events" }, { label: "Analytics" }]}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard title="Registrations" value={String(stats.registrations || 0)} icon={ClipboardList} iconColor="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" />
        <StatCard title="Confirmed" value={String(stats.confirmed || 0)} icon={Users} iconColor="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" />
        <StatCard title="Checked In" value={String(stats.checkedIn || 0)} icon={QrCode} iconColor="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" description={stats.registrations > 0 ? `${Math.round((stats.checkedIn / stats.registrations) * 100)}% attendance` : "0%"} />
        <StatCard title="Revenue" value={`₹${(stats.revenue || 0).toLocaleString("en-IN")}`} icon={IndianRupee} iconColor="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" />
        <StatCard title="Avg Rating" value={stats.rating ? stats.rating.toFixed(1) : "—"} icon={Star} iconColor="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" />
      </div>

      {/* Funnel */}
      <Card className="p-6">
        <h3 className="text-sm font-medium mb-4">Registration Funnel</h3>
        <div className="space-y-3">
          {[
            { label: "Registrations", count: stats.registrations || 0, color: "bg-blue-500" },
            { label: "Confirmed", count: stats.confirmed || 0, color: "bg-green-500" },
            { label: "Checked In", count: stats.checkedIn || 0, color: "bg-emerald-500" },
          ].map((step, i) => {
            const maxCount = stats.registrations || 1
            const pct = Math.round((step.count / maxCount) * 100)
            return (
              <div key={step.label} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{step.label}</span>
                  <span className="text-muted-foreground">{step.count} ({pct}%)</span>
                </div>
                <div className="h-3 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full rounded-full ${step.color} transition-all`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Revenue Breakdown */}
      {stats.revenueBreakdown && (
        <Card className="p-6">
          <h3 className="text-sm font-medium mb-4">Revenue Breakdown</h3>
          <div className="grid gap-4 sm:grid-cols-3 text-center">
            <div><p className="text-2xl font-bold">₹{(stats.revenueBreakdown?.gross || 0).toLocaleString("en-IN")}</p><p className="text-xs text-muted-foreground">Gross Revenue</p></div>
            <div><p className="text-2xl font-bold text-red-500">-₹{(stats.revenueBreakdown?.refunds || 0).toLocaleString("en-IN")}</p><p className="text-xs text-muted-foreground">Refunds</p></div>
            <div><p className="text-2xl font-bold text-green-600">₹{(stats.revenueBreakdown?.net || 0).toLocaleString("en-IN")}</p><p className="text-xs text-muted-foreground">Net Revenue</p></div>
          </div>
        </Card>
      )}
    </div>
  )
}
