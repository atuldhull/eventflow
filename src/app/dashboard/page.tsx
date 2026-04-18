"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { Calendar, Ticket, Award, CreditCard, MapPin, Monitor, Loader2 } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/shared/PageHeader"

interface DashboardData {
  stats: { registrations: number; activeTickets: number; certificates: number; totalSpent: number }
  upcomingEvents: { registrationId: string; status: string; id: string; title: string; slug: string; startDate: string; venue: string | null; venueCity: string | null; isOnline: boolean; category: string; organization: { name: string } }[]
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const [data, setData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const res = await fetch("/api/users/me/dashboard")
        const json = await res.json()
        if (json.success) setData(json.data)
      } catch {} finally { setIsLoading(false) }
    }
    fetchDashboard()
  }, [])

  const stats = data?.stats || { registrations: 0, activeTickets: 0, certificates: 0, totalSpent: 0 }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${session?.user?.name?.split(" ")[0] || "User"}!`}
        description="Here's an overview of your activity"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { href: "/dashboard/events", icon: Calendar, color: "bg-blue-100 dark:bg-blue-900/30", iconColor: "text-blue-600 dark:text-blue-400", value: stats.registrations, label: "Events Registered" },
          { href: "/dashboard/tickets", icon: Ticket, color: "bg-green-100 dark:bg-green-900/30", iconColor: "text-green-600 dark:text-green-400", value: stats.activeTickets, label: "Active Tickets" },
          { href: "/dashboard/certificates", icon: Award, color: "bg-purple-100 dark:bg-purple-900/30", iconColor: "text-purple-600 dark:text-purple-400", value: stats.certificates, label: "Certificates" },
          { href: "/dashboard/payments", icon: CreditCard, color: "bg-orange-100 dark:bg-orange-900/30", iconColor: "text-orange-600 dark:text-orange-400", value: `₹${stats.totalSpent.toLocaleString("en-IN")}`, label: "Total Spent" },
        ].map(({ href, icon: Icon, color, iconColor, value, label }) => (
          <Link key={href} href={href}>
            <Card className="p-6 hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
                  <Icon className={`h-5 w-5 ${iconColor}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{isLoading ? "—" : value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h3 className="text-sm font-medium mb-4">Upcoming Events</h3>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : data?.upcomingEvents && data.upcomingEvents.length > 0 ? (
            <div className="space-y-3">
              {data.upcomingEvents.map((event) => {
                const start = new Date(event.startDate)
                const diffMs = start.getTime() - Date.now()
                const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
                const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
                const countdown =
                  diffMs <= 0 ? "Happening now" :
                  diffHours < 1 ? "Starting soon" :
                  diffHours < 24 ? `in ${diffHours}h` :
                  diffDays === 1 ? "Tomorrow" :
                  diffDays < 7 ? `in ${diffDays} days` :
                  diffDays < 30 ? `in ${Math.round(diffDays / 7)} week${Math.round(diffDays / 7) === 1 ? "" : "s"}` :
                  `in ${Math.round(diffDays / 30)} month${Math.round(diffDays / 30) === 1 ? "" : "s"}`
                const isSoon = diffDays < 3 && diffMs > 0
                return (
                  <Link key={event.registrationId} href={`/events/${event.slug}`} className="flex items-center justify-between rounded-md border p-3 hover:bg-accent transition-colors">
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{event.title}</p>
                        {isSoon && <Badge variant="default" className="text-[10px] shrink-0">{countdown}</Badge>}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>
                          {start.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                          {" \u00B7 "}
                          {start.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-1 truncate">
                          {event.isOnline ? <Monitor className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
                          <span className="truncate">{event.isOnline ? "Online" : (event.venue || event.venueCity || "TBA")}</span>
                        </span>
                      </div>
                      {!isSoon && <p className="text-[11px] text-muted-foreground">{countdown}</p>}
                    </div>
                    <Badge variant="secondary" className="text-[10px] shrink-0 ml-2">{event.category}</Badge>
                  </Link>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <Calendar className="mx-auto h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">No upcoming events</p>
              <Link href="/events" className="text-xs text-primary hover:underline mt-1 inline-block">Browse events</Link>
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-medium mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-2">
            <Link href="/events" className="rounded-lg border p-3 text-center hover:bg-accent transition-colors">
              <Calendar className="mx-auto h-5 w-5 text-muted-foreground mb-1" />
              <p className="text-xs font-medium">Browse Events</p>
            </Link>
            <Link href="/dashboard/tickets" className="rounded-lg border p-3 text-center hover:bg-accent transition-colors">
              <Ticket className="mx-auto h-5 w-5 text-muted-foreground mb-1" />
              <p className="text-xs font-medium">My Tickets</p>
            </Link>
            <Link href="/dashboard/certificates" className="rounded-lg border p-3 text-center hover:bg-accent transition-colors">
              <Award className="mx-auto h-5 w-5 text-muted-foreground mb-1" />
              <p className="text-xs font-medium">Certificates</p>
            </Link>
            <Link href="/dashboard/profile" className="rounded-lg border p-3 text-center hover:bg-accent transition-colors">
              <CreditCard className="mx-auto h-5 w-5 text-muted-foreground mb-1" />
              <p className="text-xs font-medium">My Profile</p>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  )
}
