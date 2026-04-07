"use client"

import { use } from "react"
import { Eye, Users, ClipboardList, IndianRupee, QrCode, Star, Download } from "lucide-react"
import Link from "next/link"

import { PageHeader } from "@/components/shared/PageHeader"
import { StatCard } from "@/components/shared/StatCard"
import { Card } from "@/components/ui/card"
import { Button, buttonVariants } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/permissions"
import { FunnelChart } from "@/components/analytics/FunnelChart"
import { PerformanceScore } from "@/components/analytics/PerformanceScore"
import { cn } from "@/lib/utils"

export default function EventAnalyticsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params)

  // In production: fetch from /api/admin/org/{orgId}/events/{eventId}/analytics
  const funnel = [
    { label: "Page Views", count: 0, percentage: 100 },
    { label: "Registrations", count: 0, percentage: 0, conversionFromPrevious: 0 },
    { label: "Confirmed", count: 0, percentage: 0, conversionFromPrevious: 0 },
    { label: "Checked In", count: 0, percentage: 0, conversionFromPrevious: 0 },
    { label: "Feedback Given", count: 0, percentage: 0, conversionFromPrevious: 0 },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Event Analytics"
        description="Detailed performance metrics"
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Organization", href: "/admin/org" },
          { label: "Events", href: "/admin/org/events" },
          { label: "Analytics" },
        ]}
        actions={
          <PermissionGate permission={PERMISSIONS.ANALYTICS_EXPORT}>
            <Button variant="outline" className="gap-2"><Download className="h-4 w-4" /> Export Report</Button>
          </PermissionGate>
        }
      />

      {/* Key Metrics */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-6">
        <StatCard title="Page Views" value="0" icon={Eye} iconColor="bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400" />
        <StatCard title="Registrations" value="0" icon={ClipboardList} iconColor="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" />
        <StatCard title="Confirmed" value="0" icon={Users} iconColor="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" />
        <PermissionGate permission={PERMISSIONS.PAYMENT_VIEW}>
          <StatCard title="Revenue" value="₹0" icon={IndianRupee} iconColor="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" />
        </PermissionGate>
        <StatCard title="Check-ins" value="0" icon={QrCode} iconColor="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" description="0% attendance" />
        <StatCard title="Rating" value="—" icon={Star} iconColor="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" description="0 reviews" />
      </div>

      {/* Registration Funnel */}
      <Card className="p-6">
        <h3 className="text-sm font-medium mb-4">Registration Funnel</h3>
        <FunnelChart stages={funnel} />
        <p className="text-xs text-muted-foreground mt-4 text-center">
          Funnel data will populate when the event receives page views and registrations.
        </p>
      </Card>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h3 className="text-sm font-medium mb-4">Registration Trends</h3>
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
            Chart will render when registration data is available
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-medium mb-4">Status Distribution</h3>
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
            Chart will render when registration data is available
          </div>
        </Card>
      </div>

      {/* Revenue + Check-in */}
      <div className="grid gap-6 lg:grid-cols-2">
        <PermissionGate permission={PERMISSIONS.PAYMENT_VIEW}>
          <Card className="p-6">
            <h3 className="text-sm font-medium mb-4">Revenue Breakdown</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Gross Revenue</span><span>₹0</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Coupons</span><span>-₹0</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Refunds</span><span>-₹0</span></div>
              <Separator />
              <div className="flex justify-between font-medium"><span>Net Revenue</span><span>₹0</span></div>
            </div>
          </Card>
        </PermissionGate>

        <Card className="p-6">
          <h3 className="text-sm font-medium mb-4">Check-in Progress</h3>
          <div className="flex items-center justify-center py-4">
            <PerformanceScore score={0} label="Attendance Rate" size="lg" />
          </div>
        </Card>
      </div>

      {/* Feedback */}
      <Card className="p-6">
        <h3 className="text-sm font-medium mb-4">Feedback Summary</h3>
        <p className="text-sm text-muted-foreground text-center py-8">
          Feedback data will appear after participants submit their reviews.
        </p>
      </Card>
    </div>
  )
}
