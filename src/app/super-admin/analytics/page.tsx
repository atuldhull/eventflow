import { Users, Calendar, Building2, IndianRupee, TrendingUp, CreditCard } from "lucide-react"
import { PageHeader } from "@/components/shared/PageHeader"
import { StatCard } from "@/components/shared/StatCard"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function PlatformAnalyticsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Analytics"
        description="Comprehensive analytics across the entire platform"
        breadcrumbs={[{ label: "Super Admin", href: "/super-admin" }, { label: "Analytics" }]}
      />

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-6">
        <StatCard title="Total Users" value="0" icon={Users} iconColor="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" />
        <StatCard title="Events" value="0" icon={Calendar} iconColor="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" />
        <StatCard title="Enterprises" value="0" icon={Building2} iconColor="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" />
        <StatCard title="Revenue" value="₹0" icon={IndianRupee} iconColor="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" />
        <StatCard title="Registrations" value="0" icon={TrendingUp} iconColor="bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400" />
        <StatCard title="MRR" value="₹0" icon={CreditCard} iconColor="bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400" />
      </div>

      <Card className="p-6">
        <Tabs defaultValue="growth">
          <TabsList>
            <TabsTrigger value="growth">Platform Growth</TabsTrigger>
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
            <TabsTrigger value="health">System Health</TabsTrigger>
          </TabsList>
          <TabsContent value="growth" className="mt-4">
            <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">User growth chart will render when data is available</div>
          </TabsContent>
          <TabsContent value="revenue" className="mt-4">
            <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">Revenue breakdown will render when data is available</div>
          </TabsContent>
          <TabsContent value="events" className="mt-4">
            <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">Event volume chart will render when data is available</div>
          </TabsContent>
          <TabsContent value="health" className="mt-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="p-4 text-center"><p className="text-2xl font-bold text-green-500">99.9%</p><p className="text-xs text-muted-foreground">Uptime</p></Card>
              <Card className="p-4 text-center"><p className="text-2xl font-bold">0ms</p><p className="text-xs text-muted-foreground">Avg Response</p></Card>
              <Card className="p-4 text-center"><p className="text-2xl font-bold text-green-500">0</p><p className="text-xs text-muted-foreground">Errors (24h)</p></Card>
            </div>
          </TabsContent>
        </Tabs>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h3 className="text-sm font-medium mb-4">Tenant Health</h3>
          <p className="text-sm text-muted-foreground text-center py-8">Active vs inactive tenants, churn rate</p>
        </Card>
        <Card className="p-6">
          <h3 className="text-sm font-medium mb-4">Revenue by Plan</h3>
          <p className="text-sm text-muted-foreground text-center py-8">Subscription revenue breakdown</p>
        </Card>
      </div>
    </div>
  )
}
