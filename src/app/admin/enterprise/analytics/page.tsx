"use client"

import { Calendar, ClipboardList, IndianRupee, Users, Building2, TrendingUp, Star, Download } from "lucide-react"

import { PageHeader } from "@/components/shared/PageHeader"
import { StatCard } from "@/components/shared/StatCard"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ComparisonTable } from "@/components/analytics/ComparisonTable"
import { useRBAC } from "@/hooks/useRBAC"

export default function EnterpriseAnalyticsPage() {
  const { currentEnterpriseId, accessibleEnterprises } = useRBAC()
  const enterprise = accessibleEnterprises.find((e) => e.id === currentEnterpriseId)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Enterprise Analytics"
        description={`${enterprise?.name || "Enterprise"} — Performance Overview`}
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Enterprise", href: "/admin/enterprise" },
          { label: "Analytics" },
        ]}
        actions={<Button variant="outline" className="gap-2"><Download className="h-4 w-4" /> Export Report</Button>}
      />

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard title="Organizations" value="0" icon={Building2} iconColor="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" />
        <StatCard title="Total Events" value="0" icon={Calendar} iconColor="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" />
        <StatCard title="Registrations" value="0" icon={ClipboardList} iconColor="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" />
        <StatCard title="Revenue" value="₹0" icon={IndianRupee} iconColor="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" />
      </div>

      <Card className="p-6">
        <Tabs defaultValue="registrations">
          <TabsList>
            <TabsTrigger value="registrations">Registrations</TabsTrigger>
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
          </TabsList>
          <TabsContent value="registrations" className="mt-4">
            <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">Trend chart will render when data is available</div>
          </TabsContent>
          <TabsContent value="revenue" className="mt-4">
            <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">Trend chart will render when data is available</div>
          </TabsContent>
          <TabsContent value="events" className="mt-4">
            <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">Trend chart will render when data is available</div>
          </TabsContent>
        </Tabs>
      </Card>

      <Card className="p-6">
        <h3 className="text-sm font-medium mb-4">Organization Comparison</h3>
        <p className="text-sm text-muted-foreground text-center py-8">
          Organization performance comparison will appear when multiple orgs have data.
        </p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h3 className="text-sm font-medium mb-4">Events by Category</h3>
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">Chart will render when data is available</div>
        </Card>
        <Card className="p-6">
          <h3 className="text-sm font-medium mb-4">Revenue by Organization</h3>
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">Chart will render when data is available</div>
        </Card>
      </div>
    </div>
  )
}
