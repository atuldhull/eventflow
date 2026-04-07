"use client"

import { useState, useEffect } from "react"
import { Users, Calendar, Building2, IndianRupee, Loader2 } from "lucide-react"
import Link from "next/link"
import { PageHeader } from "@/components/shared/PageHeader"
import { StatCard } from "@/components/shared/StatCard"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState({ totalUsers: 0, totalEvents: 0, activeEnterprises: 0, totalRevenue: 0 })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/super-admin/dashboard-stats")
        const json = await res.json()
        if (json.success) setStats(json.data)
      } catch {} finally { setIsLoading(false) }
    }
    fetchStats()
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader title="Platform Dashboard" description="Overview of the EventFlow platform" breadcrumbs={[{ label: "Super Admin" }]} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Users" value={isLoading ? "—" : stats.totalUsers.toLocaleString()} icon={Users} iconColor="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" />
        <StatCard title="Total Events" value={isLoading ? "—" : stats.totalEvents.toLocaleString()} icon={Calendar} iconColor="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" />
        <StatCard title="Enterprises" value={isLoading ? "—" : stats.activeEnterprises.toLocaleString()} icon={Building2} iconColor="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" />
        <StatCard title="Revenue" value={isLoading ? "—" : `₹${stats.totalRevenue.toLocaleString("en-IN")}`} icon={IndianRupee} iconColor="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium">Quick Links</h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Link href="/super-admin/enterprises" className="rounded-lg border p-3 text-center hover:bg-accent transition-colors"><Building2 className="mx-auto h-5 w-5 text-muted-foreground mb-1" /><p className="text-xs font-medium">Enterprises</p></Link>
            <Link href="/super-admin/users" className="rounded-lg border p-3 text-center hover:bg-accent transition-colors"><Users className="mx-auto h-5 w-5 text-muted-foreground mb-1" /><p className="text-xs font-medium">Users</p></Link>
            <Link href="/super-admin/analytics" className="rounded-lg border p-3 text-center hover:bg-accent transition-colors"><Calendar className="mx-auto h-5 w-5 text-muted-foreground mb-1" /><p className="text-xs font-medium">Analytics</p></Link>
            <Link href="/super-admin/audit" className="rounded-lg border p-3 text-center hover:bg-accent transition-colors"><Calendar className="mx-auto h-5 w-5 text-muted-foreground mb-1" /><p className="text-xs font-medium">Audit Logs</p></Link>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium">System Health</h3>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Database</span><Badge variant="default" className="bg-green-500">Connected</Badge></div>
            <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Email Service</span><Badge variant="default" className="bg-green-500">Active</Badge></div>
            <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">API</span><Badge variant="default" className="bg-green-500">Healthy</Badge></div>
          </div>
        </Card>
      </div>
    </div>
  )
}
