"use client"

import { useState, useEffect } from "react"
import { Calendar, ClipboardList, IndianRupee, Users, TrendingUp, Star, Download, Loader2 } from "lucide-react"

import { PageHeader } from "@/components/shared/PageHeader"
import { StatCard } from "@/components/shared/StatCard"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/permissions"
import { useRBAC } from "@/hooks/useRBAC"

interface AnalyticsData {
  overview: { totalEvents: number; totalRegistrations: number; totalRevenue: number; attendanceRate: number; avgRating: number; returningParticipants: number }
  eventPerformance: { id: string; title: string; registrations: number; capacity: number | null; checkIns: number; revenue: number; status: string }[]
  categoryBreakdown: { category: string; events: number; registrations: number }[]
}

export default function OrgAnalyticsPage() {
  const { currentOrganizationId, accessibleOrganizations } = useRBAC()
  const org = accessibleOrganizations.find((o) => o.id === currentOrganizationId)
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!currentOrganizationId) return
    async function fetchAnalytics() {
      try {
        const res = await fetch(`/api/admin/org/${currentOrganizationId}/analytics`)
        const json = await res.json()
        if (json.success) setData(json.data)
      } catch {} finally { setIsLoading(false) }
    }
    fetchAnalytics()
  }, [currentOrganizationId])

  const ov = data?.overview || { totalEvents: 0, totalRegistrations: 0, totalRevenue: 0, attendanceRate: 0, avgRating: 0, returningParticipants: 0 }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description={`${org?.name || "Organization"} — Performance Overview`}
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Organization", href: "/admin/org" }, { label: "Analytics" }]}
        actions={
          <PermissionGate permission={PERMISSIONS.ANALYTICS_EXPORT}>
            <Button variant="outline" className="gap-2" onClick={() => window.open(`/api/admin/org/${currentOrganizationId}/analytics/export`)}>
              <Download className="h-4 w-4" /> Export Report
            </Button>
          </PermissionGate>
        }
      />

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-6">
        <StatCard title="Total Events" value={isLoading ? "—" : String(ov.totalEvents)} icon={Calendar} iconColor="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" />
        <StatCard title="Registrations" value={isLoading ? "—" : String(ov.totalRegistrations)} icon={ClipboardList} iconColor="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" />
        <PermissionGate permission={PERMISSIONS.PAYMENT_VIEW}>
          <StatCard title="Revenue" value={isLoading ? "—" : `₹${ov.totalRevenue.toLocaleString("en-IN")}`} icon={IndianRupee} iconColor="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" />
        </PermissionGate>
        <StatCard title="Attendance" value={isLoading ? "—" : `${ov.attendanceRate}%`} icon={Users} iconColor="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" />
        <StatCard title="Avg Rating" value={isLoading ? "—" : (ov.avgRating ? ov.avgRating.toFixed(1) : "—")} icon={Star} iconColor="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" />
        <StatCard title="Returning" value={isLoading ? "—" : String(ov.returningParticipants)} icon={TrendingUp} iconColor="bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400" description="participants" />
      </div>

      {/* Event Performance */}
      <Card className="p-6">
        <h3 className="text-sm font-medium mb-4">Event Performance</h3>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : data?.eventPerformance && data.eventPerformance.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-xs text-muted-foreground">
                <th className="pb-2 pr-4">Event</th><th className="pb-2 pr-4">Status</th><th className="pb-2 pr-4">Registrations</th><th className="pb-2 pr-4">Check-ins</th><th className="pb-2 pr-4">Attendance</th><th className="pb-2">Revenue</th>
              </tr></thead>
              <tbody>
                {data.eventPerformance.map((ev) => {
                  const att = ev.registrations > 0 ? Math.round((ev.checkIns / ev.registrations) * 100) : 0
                  return (
                    <tr key={ev.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium">{ev.title}</td>
                      <td className="py-2 pr-4"><Badge variant="secondary" className="text-[10px]">{ev.status}</Badge></td>
                      <td className="py-2 pr-4">{ev.registrations}{ev.capacity ? ` / ${ev.capacity}` : ""}</td>
                      <td className="py-2 pr-4">{ev.checkIns}</td>
                      <td className="py-2 pr-4">{att}%</td>
                      <td className="py-2">{ev.revenue > 0 ? `₹${ev.revenue.toLocaleString("en-IN")}` : "Free"}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">No event data yet. Create and publish events to see performance analytics.</p>
        )}
      </Card>

      {/* Category Analysis */}
      {data?.categoryBreakdown && data.categoryBreakdown.length > 0 && (
        <Card className="p-6">
          <h3 className="text-sm font-medium mb-4">Events by Category</h3>
          <div className="space-y-3">
            {data.categoryBreakdown.map((cat) => (
              <div key={cat.category} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge variant="secondary">{cat.category}</Badge>
                  <span className="text-sm text-muted-foreground">{cat.events} event{cat.events !== 1 ? "s" : ""}</span>
                </div>
                <span className="text-sm font-medium">{cat.registrations} registrations</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
