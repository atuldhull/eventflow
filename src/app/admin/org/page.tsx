"use client"

import { Calendar, ClipboardList, IndianRupee, Users, Plus, UserPlus, QrCode, BarChart3 } from "lucide-react"
import Link from "next/link"
import { PageHeader } from "@/components/shared/PageHeader"
import { StatCard } from "@/components/shared/StatCard"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { useRBAC } from "@/hooks/useRBAC"
import { PERMISSIONS } from "@/lib/permissions"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default function OrgDashboard() {
  const { currentOrganizationId, accessibleOrganizations } = useRBAC()
  const org = accessibleOrganizations.find((o) => o.id === currentOrganizationId)

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
        <StatCard title="Total Events" value="0" icon={Calendar} iconColor="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" description="0 active" />
        <StatCard title="Registrations" value="0" icon={ClipboardList} iconColor="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" description="this week" />
        <PermissionGate permission={PERMISSIONS.PAYMENT_VIEW}>
          <StatCard title="Revenue" value="₹0" icon={IndianRupee} iconColor="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" description="this month" />
        </PermissionGate>
        <StatCard title="Team Members" value="0" icon={Users} iconColor="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" description="active" />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium">Upcoming Events</h3>
            <Link href="/admin/org/events" className="text-xs text-primary hover:underline">View All</Link>
          </div>
          <p className="text-sm text-muted-foreground text-center py-8">No upcoming events. Create your first event to get started.</p>
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
