"use client"

import { useState, useEffect } from "react"
import { Users, Calendar, Building2, IndianRupee } from "lucide-react"
import { PageHeader } from "@/components/shared/PageHeader"
import { StatCard } from "@/components/shared/StatCard"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default function SuperAdminAnalyticsPage() {
  const [stats, setStats] = useState({ totalUsers: 0, totalEvents: 0, activeEnterprises: 0, totalRevenue: 0 })
  const [recentEvents, setRecentEvents] = useState<any[]>([])
  const [recentActivity, setRecentActivity] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetch_() {
      try {
        const res = await fetch("/api/super-admin/dashboard-stats")
        const json = await res.json()
        if (json.success) {
          setStats(json.data)
          setRecentEvents(json.data.recentEvents || [])
          setRecentActivity(json.data.recentActivity || [])
        }
      } catch {} finally { setIsLoading(false) }
    }
    fetch_()
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader title="Platform Analytics" description="Platform-wide performance overview" breadcrumbs={[{ label: "Super Admin", href: "/super-admin" }, { label: "Analytics" }]} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Users" value={isLoading ? "—" : stats.totalUsers.toLocaleString()} icon={Users} iconColor="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" />
        <StatCard title="Total Events" value={isLoading ? "—" : stats.totalEvents.toLocaleString()} icon={Calendar} iconColor="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" />
        <StatCard title="Enterprises" value={isLoading ? "—" : stats.activeEnterprises.toLocaleString()} icon={Building2} iconColor="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" />
        <StatCard title="Revenue" value={isLoading ? "—" : `₹${stats.totalRevenue.toLocaleString("en-IN")}`} icon={IndianRupee} iconColor="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h3 className="text-sm font-medium mb-4">Recent Events</h3>
          {recentEvents.length > 0 ? (
            <div className="space-y-2">{recentEvents.map((e: any) => (
              <div key={e.id} className="flex items-center justify-between rounded-md border p-3">
                <div><p className="text-sm font-medium">{e.title}</p><p className="text-xs text-muted-foreground">{new Date(e.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · {e.currentRegistrations} registrations</p></div>
                <Badge variant="secondary">{e.status}</Badge>
              </div>
            ))}</div>
          ) : <p className="text-sm text-muted-foreground text-center py-8">No events yet</p>}
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-medium mb-4">Recent Activity</h3>
          {recentActivity.length > 0 ? (
            <div className="space-y-2">{recentActivity.map((a: any) => (
              <div key={a.id} className="flex items-center justify-between rounded-md border p-3">
                <div><p className="text-sm">{a.description || a.action}</p><p className="text-xs text-muted-foreground">{a.userName} · {new Date(a.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p></div>
                <Badge variant="secondary">{a.action}</Badge>
              </div>
            ))}</div>
          ) : <p className="text-sm text-muted-foreground text-center py-8">No activity yet</p>}
        </Card>
      </div>
    </div>
  )
}
