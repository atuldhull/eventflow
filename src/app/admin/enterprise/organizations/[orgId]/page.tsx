"use client"

import { use } from "react"
import { Building2 } from "lucide-react"
import { PageHeader } from "@/components/shared/PageHeader"
import { StatCard } from "@/components/shared/StatCard"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar, Users, ClipboardList, IndianRupee } from "lucide-react"
import Link from "next/link"

export default function OrgDetailPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = use(params)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organization Details"
        description="View and manage this organization"
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Enterprise", href: "/admin/enterprise" },
          { label: "Organizations", href: "/admin/enterprise/organizations" },
          { label: "Details" },
        ]}
        actions={
          <div className="flex gap-2">
            <Link href={`/admin/enterprise/organizations/${orgId}/edit`}>
              <Button variant="outline">Edit</Button>
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard title="Events" value="0" icon={Calendar} iconColor="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" />
        <StatCard title="Members" value="0" icon={Users} iconColor="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" />
        <StatCard title="Registrations" value="0" icon={ClipboardList} iconColor="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" />
        <StatCard title="Revenue" value="₹0" icon={IndianRupee} iconColor="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" />
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Card className="p-6">
            <p className="text-sm text-muted-foreground text-center py-8">
              Organization details will appear here when connected to the database.
            </p>
          </Card>
        </TabsContent>

        <TabsContent value="events" className="mt-4">
          <Card className="p-6">
            <p className="text-sm text-muted-foreground text-center py-8">
              Events for this organization will appear here.
            </p>
          </Card>
        </TabsContent>

        <TabsContent value="members" className="mt-4">
          <Card className="p-6">
            <p className="text-sm text-muted-foreground text-center py-8">
              Organization members will appear here.
            </p>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="mt-4">
          <Card className="p-6">
            <p className="text-sm text-muted-foreground text-center py-8">
              Analytics for this organization will appear here.
            </p>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
