"use client"

import { use, useState, useEffect } from "react"
import Link from "next/link"
import {
  Calendar, Users, ClipboardList, IndianRupee, Edit, Share2,
  MoreHorizontal, Megaphone, UserPlus, Settings, MapPin, Monitor, Ticket, Clock, Loader2, Globe, Eye,
} from "lucide-react"

import { PageHeader } from "@/components/shared/PageHeader"
import { StatCard } from "@/components/shared/StatCard"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { ShareModal } from "@/components/events/ShareModal"
import { PERMISSIONS } from "@/lib/permissions"
import { useRBAC } from "@/hooks/useRBAC"
import { cn } from "@/lib/utils"

const statusColors: Record<string, string> = {
  DRAFT: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  PUBLISHED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  REGISTRATION_OPEN: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  ONGOING: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  COMPLETED: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  CANCELLED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
}

export default function EventDetailPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params)
  const { currentOrganizationId } = useRBAC()
  const [activeTab, setActiveTab] = useState("overview")
  const [event, setEvent] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!currentOrganizationId) return
    async function fetchEvent() {
      try {
        const res = await fetch(`/api/admin/org/${currentOrganizationId}/events/${eventId}`)
        const json = await res.json()
        if (json.success) setEvent(json.data)
      } catch {} finally { setIsLoading(false) }
    }
    fetchEvent()
  }, [currentOrganizationId, eventId])

  if (isLoading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  }

  if (!event) {
    return <div className="text-center py-12"><p className="text-muted-foreground">Event not found.</p></div>
  }

  const eventUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/events/${event.slug}`
  const registrations = event._count?.registrations || 0
  const checkIns = event._count?.checkIns || 0
  const attendancePct = registrations > 0 ? Math.round((checkIns / registrations) * 100) : 0

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Not set"

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Link href="/admin/org/events" className="text-sm text-muted-foreground hover:text-foreground">
              ← Events
            </Link>
          </div>
          <h1 className="text-2xl font-bold">{event.title}</h1>
          <p className="text-sm text-muted-foreground">{event.shortDescription}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className={statusColors[event.status] || ""}>{event.status?.replace(/_/g, " ")}</Badge>
          <Badge variant="outline">{event.visibility}</Badge>
          <PermissionGate permission={PERMISSIONS.EVENT_EDIT}>
            <Link href={`/admin/org/events/${eventId}/edit`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-2")}>
              <Edit className="h-4 w-4" /> Edit
            </Link>
          </PermissionGate>
          <ShareModal url={eventUrl} title={event.title} description={event.shortDescription} />
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="icon-sm" />}>
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem><a href={eventUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 w-full"><Eye className="h-4 w-4" /> Preview Public Page</a></DropdownMenuItem>
              <DropdownMenuSeparator />
              <PermissionGate permission={PERMISSIONS.EVENT_CANCEL}>
                <DropdownMenuItem className="text-destructive">Cancel Event</DropdownMenuItem>
              </PermissionGate>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard title="Registrations" value={String(registrations)} icon={ClipboardList} iconColor="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" description="total" />
        <StatCard title="Capacity" value={event.maxCapacity ? String(event.maxCapacity) : "∞"} icon={Users} iconColor="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" description={event.maxCapacity ? `${Math.round((registrations / event.maxCapacity) * 100)}% filled` : "unlimited"} />
        <PermissionGate permission={PERMISSIONS.PAYMENT_VIEW}>
          <StatCard title="Revenue" value={event.isPaid ? "₹—" : "Free"} icon={IndianRupee} iconColor="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" />
        </PermissionGate>
        <StatCard title="Check-ins" value={String(checkIns)} icon={Users} iconColor="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" description={`${attendancePct}% attendance`} />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="registrations">Registrations</TabsTrigger>
          <TabsTrigger value="tickets">Tickets</TabsTrigger>
          <TabsTrigger value="checkin">Check-in</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* TAB: Overview */}
        <TabsContent value="overview" className="mt-4 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card className="p-4 space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground"><Calendar className="h-4 w-4" /><span className="text-xs font-medium">Date & Time</span></div>
              <p className="text-sm font-medium">{formatDate(event.startDate)}</p>
              <p className="text-xs text-muted-foreground">to {formatDate(event.endDate)}</p>
            </Card>
            <Card className="p-4 space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground"><Clock className="h-4 w-4" /><span className="text-xs font-medium">Registration Window</span></div>
              <p className="text-sm font-medium">{event.registrationStartDate ? formatDate(event.registrationStartDate) : "Open"}</p>
              {event.registrationEndDate && <p className="text-xs text-muted-foreground">to {formatDate(event.registrationEndDate)}</p>}
            </Card>
            <Card className="p-4 space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                {event.isOnline ? <Monitor className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
                <span className="text-xs font-medium">{event.isOnline ? "Online Event" : "Venue"}</span>
              </div>
              <p className="text-sm font-medium">{event.isOnline ? (event.onlinePlatform || "Virtual") : (event.venue || "Not set")}</p>
              {!event.isOnline && event.venueCity && <p className="text-xs text-muted-foreground">{[event.venueCity, event.venueState].filter(Boolean).join(", ")}</p>}
            </Card>
            <Card className="p-4 space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground"><Users className="h-4 w-4" /><span className="text-xs font-medium">Capacity</span></div>
              <p className="text-sm font-medium">{event.maxCapacity || "Unlimited"}</p>
            </Card>
            <Card className="p-4 space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground"><Ticket className="h-4 w-4" /><span className="text-xs font-medium">Tickets</span></div>
              <p className="text-sm font-medium">{event.isPaid ? "Paid" : "Free"} · {event.ticketTypes?.length || 0} types</p>
            </Card>
            <Card className="p-4 space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground"><Globe className="h-4 w-4" /><span className="text-xs font-medium">Type & Category</span></div>
              <p className="text-sm font-medium">{event.type} · {event.category}</p>
            </Card>
          </div>

          {event.description && (
            <Card className="p-6">
              <h3 className="text-sm font-medium mb-3">Description</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{event.description}</p>
            </Card>
          )}

          {/* Ticket Types */}
          {event.ticketTypes?.length > 0 && (
            <Card className="p-6">
              <h3 className="text-sm font-medium mb-3">Ticket Types</h3>
              <div className="space-y-2">
                {event.ticketTypes.map((tt: any) => (
                  <div key={tt.id} className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <p className="text-sm font-medium">{tt.name}</p>
                      {tt.description && <p className="text-xs text-muted-foreground">{tt.description}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">{tt.price === 0 ? "Free" : `₹${tt.price}`}</p>
                      {tt.quantity && <p className="text-xs text-muted-foreground">{tt.quantity} available</p>}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </TabsContent>

        {/* TAB: Registrations */}
        <TabsContent value="registrations" className="mt-4">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium">Registrations ({registrations})</h3>
              <div className="flex gap-2">
                <PermissionGate permission={PERMISSIONS.REGISTRATION_ADD_MANUAL}>
                  <Button variant="outline" size="sm" className="gap-1"><UserPlus className="h-3.5 w-3.5" /> Add Participant</Button>
                </PermissionGate>
                <ShareModal url={eventUrl} title={event.title} description={event.shortDescription} trigger={<Button variant="outline" size="sm" className="gap-1"><Share2 className="h-3.5 w-3.5" /> Invite</Button>} />
              </div>
            </div>
            {registrations === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">No registrations yet.</p>
                <p className="text-xs text-muted-foreground mt-1">Share the event to get participants.</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                {registrations} registration(s). View full details on the registrations page.
              </p>
            )}
          </Card>
        </TabsContent>

        {/* TAB: Tickets */}
        <TabsContent value="tickets" className="mt-4 space-y-4">
          <Card className="p-6">
            <h3 className="text-sm font-medium mb-4">Ticket Types</h3>
            {event.ticketTypes?.length > 0 ? (
              <div className="space-y-2">
                {event.ticketTypes.map((tt: any) => (
                  <div key={tt.id} className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{tt.name}</p>
                        <Badge variant={tt.isActive ? "default" : "secondary"}>{tt.isActive ? "Active" : "Inactive"}</Badge>
                      </div>
                    </div>
                    <p className="text-sm font-bold">{tt.price === 0 ? "Free" : `₹${tt.price}`}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No ticket types configured.</p>
            )}
          </Card>
        </TabsContent>

        {/* TAB: Check-in */}
        <TabsContent value="checkin" className="mt-4">
          <Card className="p-6 text-center">
            <Users className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="font-medium">{checkIns > 0 ? `${checkIns} checked in` : "No check-ins yet"}</p>
            <p className="text-sm text-muted-foreground mt-1">Use the QR scanner for event check-in.</p>
            <Link href={`/admin/org/events/${eventId}/check-in`} className={cn(buttonVariants({ variant: "outline" }), "mt-3 gap-2")}>
              Open Scanner
            </Link>
          </Card>
        </TabsContent>

        {/* TAB: Settings */}
        <TabsContent value="settings" className="mt-4 space-y-4">
          <Card className="p-6 space-y-4">
            <h3 className="text-sm font-medium">Registration Settings</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Approval Required</span><Badge variant="outline">{event.approvalRequired ? "Yes" : "No"}</Badge></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Waitlist</span><Badge variant="outline">{event.waitlistEnabled ? "Enabled" : "Disabled"}</Badge></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Team Registration</span><Badge variant="outline">{event.allowTeamRegistration ? "Enabled" : "Disabled"}</Badge></div>
            </div>
          </Card>
          <Card className="p-6 space-y-4">
            <h3 className="text-sm font-medium">Visibility & Access</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Visibility</span><Badge variant="outline">{event.visibility}</Badge></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Featured</span><Badge variant="outline">{event.isFeatured ? "Yes" : "No"}</Badge></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Event Type</span><Badge variant="outline">{event.type}</Badge></div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
