"use client"

import { useSession } from "next-auth/react"
import Link from "next/link"
import { Calendar, Ticket, Award, CreditCard } from "lucide-react"
import { Card } from "@/components/ui/card"
import { PageHeader } from "@/components/shared/PageHeader"

export default function DashboardPage() {
  const { data: session } = useSession()

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${session?.user?.name?.split(" ")[0] || "User"}!`}
        description="Here's an overview of your activity"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/dashboard/events">
          <Card className="p-6 hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">0</p>
                <p className="text-xs text-muted-foreground">Events Registered</p>
              </div>
            </div>
          </Card>
        </Link>

        <Link href="/dashboard/tickets">
          <Card className="p-6 hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                <Ticket className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">0</p>
                <p className="text-xs text-muted-foreground">Active Tickets</p>
              </div>
            </div>
          </Card>
        </Link>

        <Link href="/dashboard/certificates">
          <Card className="p-6 hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <Award className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">0</p>
                <p className="text-xs text-muted-foreground">Certificates</p>
              </div>
            </div>
          </Card>
        </Link>

        <Link href="/dashboard/payments">
          <Card className="p-6 hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30">
                <CreditCard className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">₹0</p>
                <p className="text-xs text-muted-foreground">Total Spent</p>
              </div>
            </div>
          </Card>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h3 className="text-sm font-medium mb-4">Upcoming Events</h3>
          <div className="text-center py-8">
            <Calendar className="mx-auto h-8 w-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">No upcoming events</p>
            <Link href="/events" className="text-xs text-primary hover:underline mt-1 inline-block">
              Browse events
            </Link>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-medium mb-4">Recent Activity</h3>
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">No recent activity</p>
          </div>
        </Card>
      </div>
    </div>
  )
}
