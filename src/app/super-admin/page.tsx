import { Suspense } from "react"
import { Users, Calendar, Building2, IndianRupee } from "lucide-react"
import { PageHeader } from "@/components/shared/PageHeader"
import { StatCard } from "@/components/shared/StatCard"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"

async function getDashboardStats() {
  // In production this would call the database
  // For now return placeholder data
  return {
    totalUsers: 0,
    totalEvents: 0,
    activeEnterprises: 0,
    totalRevenue: 0,
    userChange: 0,
    eventChange: 0,
    recentEvents: [] as { id: string; title: string; organizer: string; date: string; status: string; registrations: number }[],
    recentActivity: [] as { id: string; user: string; action: string; description: string; createdAt: string }[],
  }
}

export default async function SuperAdminDashboard() {
  const stats = await getDashboardStats()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Dashboard"
        description="Overview of the EventFlow platform"
        breadcrumbs={[{ label: "Super Admin" }]}
      />

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Users"
          value={stats.totalUsers.toLocaleString()}
          change={{ value: stats.userChange, trend: stats.userChange >= 0 ? "up" : "down" }}
          icon={Users}
          iconColor="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
          description="from last month"
        />
        <StatCard
          title="Total Events"
          value={stats.totalEvents.toLocaleString()}
          change={{ value: stats.eventChange, trend: stats.eventChange >= 0 ? "up" : "down" }}
          icon={Calendar}
          iconColor="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
          description="this week"
        />
        <StatCard
          title="Active Enterprises"
          value={stats.activeEnterprises.toLocaleString()}
          icon={Building2}
          iconColor="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
        />
        <StatCard
          title="Platform Revenue"
          value={`₹${stats.totalRevenue.toLocaleString()}`}
          icon={IndianRupee}
          iconColor="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
          description="this month"
        />
      </div>

      {/* Content Grid */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Recent Events */}
        <Card className="lg:col-span-3 p-6">
          <h3 className="text-sm font-medium mb-4">Recent Events</h3>
          {stats.recentEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No events yet. Data will appear when events are created.</p>
          ) : (
            <div className="space-y-3">
              {stats.recentEvents.map((event) => (
                <div key={event.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">{event.title}</p>
                    <p className="text-xs text-muted-foreground">{event.organizer} · {event.date}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{event.status}</Badge>
                    <span className="text-xs text-muted-foreground">{event.registrations} reg</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Quick Actions */}
        <Card className="lg:col-span-2 p-6">
          <h3 className="text-sm font-medium mb-4">Quick Actions</h3>
          <div className="space-y-2">
            {[
              { label: "Manage Enterprises", href: "/super-admin/enterprises" },
              { label: "Manage Users", href: "/super-admin/users" },
              { label: "View Analytics", href: "/super-admin/analytics" },
              { label: "Audit Logs", href: "/super-admin/audit-logs" },
              { label: "Platform Settings", href: "/super-admin/settings" },
            ].map((action) => (
              <a
                key={action.href}
                href={action.href}
                className="block rounded-lg border p-3 text-sm font-medium hover:bg-accent transition-colors"
              >
                {action.label}
              </a>
            ))}
          </div>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="p-6">
        <h3 className="text-sm font-medium mb-4">Recent Activity</h3>
        {stats.recentActivity.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No activity yet. Actions will be logged here.</p>
        ) : (
          <div className="space-y-3">
            {stats.recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 text-sm">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                  {activity.user[0]}
                </div>
                <div>
                  <p>
                    <span className="font-medium">{activity.user}</span>{" "}
                    <span className="text-muted-foreground">{activity.description}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{activity.createdAt}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
