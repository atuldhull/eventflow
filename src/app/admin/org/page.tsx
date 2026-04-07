"use client"

import { useState, useEffect } from "react"
import { Calendar, ClipboardList, IndianRupee, Users, Plus, QrCode } from "lucide-react"
import Link from "next/link"
import { PageHeader } from "@/components/shared/PageHeader"
import { StatCard } from "@/components/shared/StatCard"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { useRBAC } from "@/hooks/useRBAC"
import { PERMISSIONS } from "@/lib/permissions"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface DashboardEvent {
  id: string
  title: string
  startDate: string
  status: string
  currentRegistrations: number
}

export default function OrgDashboard() {
  const { currentOrganizationId, accessibleOrganizations } = useRBAC()
  const org = accessibleOrganizations.find((o) => o.id === currentOrganizationId)
  const [stats, setStats] = useState({ events: 0, active: 0, registrations: 0 })
  const [upcomingEvents, setUpcomingEvents] = useState<DashboardEvent[]>([])

  useEffect(() => {
    if (!currentOrganizationId) return
    async function fetchDashboard() {
      try {
        const res = await fetch(`/api/admin/org/${currentOrganizationId}/events?limit=50`)
        const json = await res.json()
        if (json.success) {
          const events = json.data as DashboardEvent[]
          const active = events.filter((e) => ["PUBLISHED", "REGISTRATION_OPEN", "ONGOING"].includes(e.status))
          const totalRegs = events.reduce((sum: number, e: DashboardEvent) => sum + (e.currentRegistrations || 0), 0)
          setStats({ events: json.pagination.total, active: active.length, registrations: totalRegs })
          // Show upcoming events (future start date or active)
          const upcoming = events
            .filter((e) => new Date(e.startDate) >= new Date() || ["PUBLISHED", "REGISTRATION_OPEN", "ONGOING"].includes(e.status))
            .slice(0, 5)
          setUpcomingEvents(upcoming)
        }
      } catch {}
    }
    fetchDashboard()
  }, [currentOrganizationId])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Welcome back"
        description={org?.name || "Organization Dashboard"}
        breadcrumbs={[{ label: "Admin" }, { label: "Organization" }]}
        actions={
          <div className="flex gap-2 flex-wrap">
            <PermissionGate permission={PERMISSIONS.EVENT_CREATE}>
              <Link href="/admin/org/events/create" className={cn(buttonVariants({ variant: "outline" }), "gap-2")}>
                <Plus className="h-4 w-4" /> Create Event
              </Link>
            </PermissionGate>
            <PermissionGate permission={PERMISSIONS.CHECKIN_PERFORM}>
              <Link href="/admin/org/check-in" className={cn(buttonVariants({ variant: "outline" }), "gap-2")}>
                <QrCode className="h-4 w-4" /> Scan QR
              </Link>
            </PermissionGate>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Events" value={String(stats.events)} icon={Calendar} iconColor="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" description={`${stats.active} active`} />
        <StatCard title="Registrations" value={String(stats.registrations)} icon={ClipboardList} iconColor="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" description="total" />
        <PermissionGate permission={PERMISSIONS.PAYMENT_VIEW}>
          <StatCard title="Revenue" value="₹0" icon={IndianRupee} iconColor="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" description="this month" />
        </PermissionGate>
        <StatCard title="Team Members" value="—" icon={Users} iconColor="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" description="active" />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium">Upcoming Events</h3>
            <Link href="/admin/org/events" className="text-xs text-primary hover:underline">View All</Link>
          </div>
          {upcomingEvents.length > 0 ? (
            <div className="space-y-3">
              {upcomingEvents.map((event) => (
                <Link key={event.id} href={`/admin/org/events/${event.id}`} className="flex items-center justify-between rounded-md border p-3 hover:bg-accent transition-colors">
                  <div>
                    <p className="text-sm font-medium">{event.title}</p>
                    <p className="text-xs text-muted-foreground">{new Date(event.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                  </div>
                  <Badge variant="secondary">{event.status.replace(/_/g, " ")}</Badge>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No upcoming events. Create your first event to get started.</p>
          )}
        </Card>

        <Card className="lg:col-span-2 p-6 space-y-4">
          <h3 className="text-sm font-medium">Pending Actions</h3>
          <p className="text-sm text-muted-foreground text-center py-4">All caught up!</p>
          <h3 className="text-sm font-medium mt-4">Recent Activity</h3>
          <Link href="/admin/org/audit-logs" className="text-xs text-primary hover:underline">View All</Link>
          <p className="text-sm text-muted-foreground text-center py-4">No activity yet.</p>
        </Card>
      </div>
    </div>
  )
}
