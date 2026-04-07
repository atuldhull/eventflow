"use client"

import { useState, useEffect } from "react"
import { Calendar, ClipboardList, IndianRupee, Users, Building2, Download } from "lucide-react"

import { PageHeader } from "@/components/shared/PageHeader"
import { StatCard } from "@/components/shared/StatCard"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useRBAC } from "@/hooks/useRBAC"

export default function EnterpriseAnalyticsPage() {
  const { currentEnterpriseId, accessibleEnterprises } = useRBAC()
  const enterprise = accessibleEnterprises.find((e) => e.id === currentEnterpriseId)
  const [stats, setStats] = useState({ organizationCount: 0, eventCount: 0, registrationCount: 0, totalRevenue: 0 })
  const [recentEvents, setRecentEvents] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!currentEnterpriseId) return
    async function fetchAnalytics() {
      try {
        const res = await fetch(`/api/admin/enterprise/${currentEnterpriseId}/dashboard-stats`)
        const json = await res.json()
        if (json.success) {
          setStats({ organizationCount: json.data.organizationCount, eventCount: json.data.eventCount, registrationCount: json.data.registrationCount, totalRevenue: json.data.totalRevenue || 0 })
          setRecentEvents(json.data.recentEvents || [])
        }
      } catch {} finally { setIsLoading(false) }
    }
    fetchAnalytics()
  }, [currentEnterpriseId])

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" description={`${enterprise?.name || "Enterprise"} — Performance Overview`} breadcrumbs={[{ label: "Admin" }, { label: "Enterprise", href: "/admin/enterprise" }, { label: "Analytics" }]}
        actions={<Button variant="outline" className="gap-2"><Download className="h-4 w-4" /> Export Report</Button>}
      />

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard title="Organizations" value={isLoading ? "—" : String(stats.organizationCount)} icon={Building2} iconColor="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" />
        <StatCard title="Total Events" value={isLoading ? "—" : String(stats.eventCount)} icon={Calendar} iconColor="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" />
        <StatCard title="Registrations" value={isLoading ? "—" : String(stats.registrationCount)} icon={ClipboardList} iconColor="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" />
        <StatCard title="Revenue" value={isLoading ? "—" : `₹${stats.totalRevenue.toLocaleString("en-IN")}`} icon={IndianRupee} iconColor="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" />
      </div>

      <Card className="p-6">
        <h3 className="text-sm font-medium mb-4">Recent Events Across Enterprise</h3>
        {recentEvents.length > 0 ? (
          <div className="space-y-2">
            {recentEvents.map((event: any) => (
              <div key={event.id} className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">{event.title}</p>
                  <p className="text-xs text-muted-foreground">{new Date(event.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · {event.currentRegistrations} registrations</p>
                </div>
                <Badge variant="secondary">{event.status}</Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">No events yet. Create events within your organizations to see analytics.</p>
        )}
      </Card>
    </div>
  )
}
