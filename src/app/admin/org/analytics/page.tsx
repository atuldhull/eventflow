"use client"

import { Calendar, ClipboardList, IndianRupee, Users, TrendingUp, Star, Download } from "lucide-react"

import { PageHeader } from "@/components/shared/PageHeader"
import { StatCard } from "@/components/shared/StatCard"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/permissions"
import { ComparisonTable } from "@/components/analytics/ComparisonTable"
import { PerformanceScore } from "@/components/analytics/PerformanceScore"
import { useRBAC } from "@/hooks/useRBAC"

export default function OrgAnalyticsPage() {
  const { currentOrganizationId, accessibleOrganizations } = useRBAC()
  const org = accessibleOrganizations.find((o) => o.id === currentOrganizationId)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description={`${org?.name || "Organization"} — Performance Overview`}
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Organization", href: "/admin/org" },
          { label: "Analytics" },
        ]}
        actions={
          <PermissionGate permission={PERMISSIONS.ANALYTICS_EXPORT}>
            <Button variant="outline" className="gap-2" onClick={() => window.open(`/api/admin/org/${currentOrganizationId}/analytics/export`)}>
              <Download className="h-4 w-4" /> Export Report
            </Button>
          </PermissionGate>
        }
      />

      {/* Overview */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-6">
        <StatCard title="Total Events" value="0" icon={Calendar} iconColor="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" />
        <StatCard title="Registrations" value="0" icon={ClipboardList} iconColor="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" />
        <PermissionGate permission={PERMISSIONS.PAYMENT_VIEW}>
          <StatCard title="Revenue" value="₹0" icon={IndianRupee} iconColor="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" />
        </PermissionGate>
        <StatCard title="Attendance" value="0%" icon={Users} iconColor="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" />
        <StatCard title="Avg Rating" value="—" icon={Star} iconColor="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" />
        <StatCard title="Returning" value="0" icon={TrendingUp} iconColor="bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400" description="participants" />
      </div>

      {/* Trends */}
      <Card className="p-6">
        <Tabs defaultValue="registrations">
          <TabsList>
            <TabsTrigger value="registrations">Registrations</TabsTrigger>
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
            <TabsTrigger value="attendance">Attendance</TabsTrigger>
          </TabsList>
          <TabsContent value="registrations" className="mt-4">
            <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">Registration trend chart will render when data is available</div>
          </TabsContent>
          <TabsContent value="revenue" className="mt-4">
            <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">Revenue trend chart will render when data is available</div>
          </TabsContent>
          <TabsContent value="events" className="mt-4">
            <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">Events created chart will render when data is available</div>
          </TabsContent>
          <TabsContent value="attendance" className="mt-4">
            <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">Attendance rate chart will render when data is available</div>
          </TabsContent>
        </Tabs>
      </Card>

      {/* Event Performance */}
      <Card className="p-6">
        <h3 className="text-sm font-medium mb-4">Event Performance</h3>
        <p className="text-sm text-muted-foreground text-center py-8">
          Event performance table will appear when events have analytics data.
        </p>
      </Card>

      {/* Category Analysis */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h3 className="text-sm font-medium mb-4">Events by Category</h3>
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">Chart will render when data is available</div>
        </Card>
        <Card className="p-6">
          <h3 className="text-sm font-medium mb-4">Registrations by Category</h3>
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">Chart will render when data is available</div>
        </Card>
      </div>

      {/* Audience */}
      <PermissionGate permission={PERMISSIONS.ANALYTICS_VIEW_ADVANCED}>
        <Card className="p-6">
          <h3 className="text-sm font-medium mb-4">Audience Insights</h3>
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="text-center py-8 text-sm text-muted-foreground">Participant growth chart</div>
            <div className="text-center py-8 text-sm text-muted-foreground">New vs returning chart</div>
            <div className="text-center py-8 text-sm text-muted-foreground">Top cities chart</div>
          </div>
        </Card>
      </PermissionGate>
    </div>
  )
}
