"use client"

import { Users, Calendar, ClipboardList, IndianRupee, Network, Plus, UserPlus, BarChart3 } from "lucide-react"
import { PageHeader } from "@/components/shared/PageHeader"
import { StatCard } from "@/components/shared/StatCard"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { useRBAC } from "@/hooks/useRBAC"
import { PERMISSIONS } from "@/lib/permissions"
import Link from "next/link"

export default function EnterpriseDashboard() {
  const { currentEnterpriseId, accessibleEnterprises, can } = useRBAC()

  const enterprise = accessibleEnterprises.find((e) => e.id === currentEnterpriseId)

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back`}
        description={enterprise?.name || "Enterprise Dashboard"}
        breadcrumbs={[{ label: "Admin" }, { label: "Enterprise" }]}
        actions={
          <div className="flex gap-2">
            <PermissionGate permission={PERMISSIONS.EVENT_CREATE}>
              <Button variant="outline" className="gap-2">
                <Plus className="h-4 w-4" />
                Create Event
              </Button>
            </PermissionGate>
            <PermissionGate permission={PERMISSIONS.MEMBER_INVITE}>
              <Button variant="outline" className="gap-2">
                <UserPlus className="h-4 w-4" />
                Invite Member
              </Button>
            </PermissionGate>
          </div>
        }
      />

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Organizations"
          value="0"
          icon={Network}
          iconColor="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
          description="active"
        />
        <StatCard
          title="Total Events"
          value="0"
          icon={Calendar}
          iconColor="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
          description="across all orgs"
        />
        <StatCard
          title="Registrations"
          value="0"
          icon={ClipboardList}
          iconColor="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
          description="total"
        />
        <PermissionGate permission={PERMISSIONS.PAYMENT_VIEW}>
          <StatCard
            title="Revenue"
            value="₹0"
            icon={IndianRupee}
            iconColor="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
            description="this month"
          />
        </PermissionGate>
      </div>

      {/* Content Grid */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Upcoming Events */}
        <Card className="lg:col-span-3 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium">Upcoming Events</h3>
            <Link href="/admin/enterprise/events" className="text-xs text-primary hover:underline">
              View All
            </Link>
          </div>
          <p className="text-sm text-muted-foreground text-center py-8">
            No upcoming events. Create your first event to get started.
          </p>
        </Card>

        {/* Organizations */}
        <Card className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium">Organizations</h3>
            <Link href="/admin/enterprise/organizations" className="text-xs text-primary hover:underline">
              View All
            </Link>
          </div>
          <p className="text-sm text-muted-foreground text-center py-8">
            No organizations yet. Create your first organization.
          </p>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium">Recent Activity</h3>
          <Link href="/admin/enterprise/audit-logs" className="text-xs text-primary hover:underline">
            View All
          </Link>
        </div>
        <p className="text-sm text-muted-foreground text-center py-8">
          No activity yet. Actions will be logged here.
        </p>
      </Card>
    </div>
  )
}
