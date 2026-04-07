"use client"

import { useState, useEffect } from "react"
import { Users, Calendar, ClipboardList, IndianRupee, Network, Plus, UserPlus, Loader2 } from "lucide-react"
import { PageHeader } from "@/components/shared/PageHeader"
import { StatCard } from "@/components/shared/StatCard"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { useRBAC } from "@/hooks/useRBAC"
import { PERMISSIONS } from "@/lib/permissions"
import Link from "next/link"

export default function EnterpriseDashboard() {
  const { currentEnterpriseId, accessibleEnterprises } = useRBAC()
  const enterprise = accessibleEnterprises.find((e) => e.id === currentEnterpriseId)
  const [stats, setStats] = useState({ organizations: 0, events: 0, registrations: 0, revenue: 0 })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!currentEnterpriseId) return
    async function fetchStats() {
      try {
        const res = await fetch(`/api/admin/enterprise/${currentEnterpriseId}/dashboard-stats`)
        const json = await res.json()
        if (json.success) {
          setStats({
            organizations: json.data.organizationCount || 0,
            events: json.data.eventCount || 0,
            registrations: json.data.registrationCount || 0,
            revenue: json.data.totalRevenue || 0,
          })
        }
      } catch {} finally { setIsLoading(false) }
    }
    fetchStats()
  }, [currentEnterpriseId])

  return (
    <div className="space-y-6">
      <PageHeader title="Welcome back" description={enterprise?.name || "Enterprise Dashboard"}
        breadcrumbs={[{ label: "Admin" }, { label: "Enterprise" }]}
        actions={
          <div className="flex gap-2">
            <PermissionGate permission={PERMISSIONS.EVENT_CREATE}><Button variant="outline" className="gap-2"><Plus className="h-4 w-4" /> Create Event</Button></PermissionGate>
            <PermissionGate permission={PERMISSIONS.MEMBER_INVITE}><Button variant="outline" className="gap-2"><UserPlus className="h-4 w-4" /> Invite Member</Button></PermissionGate>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Organizations" value={isLoading ? "—" : String(stats.organizations)} icon={Network} iconColor="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" description="active" />
        <StatCard title="Total Events" value={isLoading ? "—" : String(stats.events)} icon={Calendar} iconColor="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" description="across all orgs" />
        <StatCard title="Registrations" value={isLoading ? "—" : String(stats.registrations)} icon={ClipboardList} iconColor="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" description="total" />
        <PermissionGate permission={PERMISSIONS.PAYMENT_VIEW}>
          <StatCard title="Revenue" value={isLoading ? "—" : `₹${stats.revenue.toLocaleString("en-IN")}`} icon={IndianRupee} iconColor="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" description="total" />
        </PermissionGate>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium">Quick Links</h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Link href="/admin/enterprise/organizations" className="rounded-lg border p-3 text-center hover:bg-accent transition-colors"><Network className="mx-auto h-5 w-5 text-muted-foreground mb-1" /><p className="text-xs font-medium">Organizations</p></Link>
            <Link href="/admin/enterprise/events" className="rounded-lg border p-3 text-center hover:bg-accent transition-colors"><Calendar className="mx-auto h-5 w-5 text-muted-foreground mb-1" /><p className="text-xs font-medium">Events</p></Link>
            <Link href="/admin/enterprise/members" className="rounded-lg border p-3 text-center hover:bg-accent transition-colors"><Users className="mx-auto h-5 w-5 text-muted-foreground mb-1" /><p className="text-xs font-medium">Members</p></Link>
            <Link href="/admin/enterprise/analytics" className="rounded-lg border p-3 text-center hover:bg-accent transition-colors"><ClipboardList className="mx-auto h-5 w-5 text-muted-foreground mb-1" /><p className="text-xs font-medium">Analytics</p></Link>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium">Recent Activity</h3>
            <Link href="/admin/enterprise/audit-logs" className="text-xs text-primary hover:underline">View All</Link>
          </div>
          <p className="text-sm text-muted-foreground text-center py-8">Actions will be logged here.</p>
        </Card>
      </div>
    </div>
  )
}
