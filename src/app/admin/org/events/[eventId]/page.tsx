"use client"

import { use, useState } from "react"
import Link from "next/link"
import {
  Calendar, Users, ClipboardList, IndianRupee, Edit, Eye, Share2,
  MoreHorizontal, Copy, Megaphone, UserPlus, Settings, MapPin, Monitor, Ticket, Clock,
} from "lucide-react"

import { PageHeader } from "@/components/shared/PageHeader"
import { StatCard } from "@/components/shared/StatCard"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { EventStatusBadge } from "@/components/events/EventStatusBadge"
import { ShareModal } from "@/components/events/ShareModal"
import { PERMISSIONS } from "@/lib/permissions"
import { cn } from "@/lib/utils"

export default function EventDetailPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params)
  const [activeTab, setActiveTab] = useState("overview")

  const eventUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/events/event-slug`

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Link href="/admin/org/events" className="text-sm text-muted-foreground hover:text-foreground">
              ← Events
            </Link>
          </div>
          <h1 className="text-2xl font-bold">Event Details</h1>
          <p className="text-sm text-muted-foreground">Manage your event</p>
        </div>
        <div className="flex items-center gap-2">
          <EventStatusBadge status="DRAFT" size="lg" />
          <PermissionGate permission={PERMISSIONS.EVENT_EDIT}>
            <Link href={`/admin/org/events/${eventId}/edit`} className={cn(buttonVariants({ variant: "outline" }), "gap-2")}>
              <Edit className="h-4 w-4" /> Edit
            </Link>
          </PermissionGate>
          <ShareModal url={eventUrl} title="Event" />
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="icon" />}>
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Preview Event Page</DropdownMenuItem>
              <DropdownMenuItem>Duplicate Event</DropdownMenuItem>
              <DropdownMenuSeparator />
              <PermissionGate permission={PERMISSIONS.EVENT_PUBLISH}>
                <DropdownMenuItem>Publish</DropdownMenuItem>
              </PermissionGate>
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
        <StatCard title="Registrations" value="0" icon={ClipboardList} iconColor="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" description="total" />
        <StatCard title="Confirmed" value="0" icon={Users} iconColor="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" description="0% of total" />
        <PermissionGate permission={PERMISSIONS.PAYMENT_VIEW}>
          <StatCard title="Revenue" value="₹0" icon={IndianRupee} iconColor="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" />
        </PermissionGate>
        <StatCard title="Check-ins" value="0" icon={Users} iconColor="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" description="0% attendance" />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="registrations">Registrations</TabsTrigger>
          <TabsTrigger value="tickets">Tickets & Sales</TabsTrigger>
          <TabsTrigger value="checkin">Check-in</TabsTrigger>
          <TabsTrigger value="announcements">Announcements</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* TAB 1: Overview */}
        <TabsContent value="overview" className="mt-4 space-y-6">
          {/* Event Details Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card className="p-4 space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span className="text-xs font-medium">Date & Time</span>
              </div>
              <p className="text-sm font-medium">Not set yet</p>
            </Card>
            <Card className="p-4 space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span className="text-xs font-medium">Registration Window</span>
              </div>
              <p className="text-sm font-medium">Not configured</p>
            </Card>
            <Card className="p-4 space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span className="text-xs font-medium">Venue</span>
              </div>
              <p className="text-sm font-medium">Not set</p>
            </Card>
            <Card className="p-4 space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="h-4 w-4" />
                <span className="text-xs font-medium">Capacity</span>
              </div>
              <p className="text-sm font-medium">Unlimited</p>
            </Card>
            <Card className="p-4 space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Ticket className="h-4 w-4" />
                <span className="text-xs font-medium">Tickets</span>
              </div>
              <p className="text-sm font-medium">Free</p>
            </Card>
            <Card className="p-4 space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Settings className="h-4 w-4" />
                <span className="text-xs font-medium">Settings</span>
              </div>
              <div className="flex flex-wrap gap-1">
                <Badge variant="outline" className="text-[10px]">Open Registration</Badge>
              </div>
            </Card>
          </div>

          {/* Registration Chart Placeholder */}
          <Card className="p-6">
            <h3 className="text-sm font-medium mb-4">Registration Trend</h3>
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
              Chart will render when registration data is available
            </div>
          </Card>

          {/* Event Timeline */}
          <Card className="p-6">
            <h3 className="text-sm font-medium mb-4">Event Timeline</h3>
            <div className="space-y-4">
              {[
                { label: "Created", done: true },
                { label: "Published", done: false },
                { label: "Registration Opens", done: false },
                { label: "Registration Closes", done: false },
                { label: "Event Starts", done: false },
                { label: "Event Ends", done: false },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-xs",
                    item.done ? "bg-green-100 text-green-600" : "bg-muted text-muted-foreground"
                  )}>
                    {item.done ? "✓" : i + 1}
                  </div>
                  <span className={cn("text-sm", item.done ? "font-medium" : "text-muted-foreground")}>{item.label}</span>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* TAB 2: Registrations */}
        <TabsContent value="registrations" className="mt-4">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium">Registrations</h3>
              <div className="flex gap-2">
                <PermissionGate permission={PERMISSIONS.REGISTRATION_ADD_MANUAL}>
                  <Button variant="outline" size="sm" className="gap-1"><UserPlus className="h-3.5 w-3.5" /> Add Participant</Button>
                </PermissionGate>
                <PermissionGate permission={PERMISSIONS.REGISTRATION_EXPORT}>
                  <Button variant="outline" size="sm">Export</Button>
                </PermissionGate>
              </div>
            </div>
            <p className="text-sm text-muted-foreground text-center py-8">
              No registrations yet. Registrations will appear here when participants sign up.
            </p>
          </Card>
        </TabsContent>

        {/* TAB 3: Tickets & Sales */}
        <TabsContent value="tickets" className="mt-4 space-y-4">
          <Card className="p-6">
            <h3 className="text-sm font-medium mb-4">Ticket Types</h3>
            <p className="text-sm text-muted-foreground text-center py-8">
              Ticket types will appear here once the event has tickets configured.
            </p>
          </Card>
          <PermissionGate permission={PERMISSIONS.PAYMENT_VIEW}>
            <Card className="p-6">
              <h3 className="text-sm font-medium mb-4">Revenue Summary</h3>
              <div className="grid gap-4 sm:grid-cols-3 text-center">
                <div><p className="text-2xl font-bold">₹0</p><p className="text-xs text-muted-foreground">Total Revenue</p></div>
                <div><p className="text-2xl font-bold">₹0</p><p className="text-xs text-muted-foreground">Refunded</p></div>
                <div><p className="text-2xl font-bold">₹0</p><p className="text-xs text-muted-foreground">Net Revenue</p></div>
              </div>
            </Card>
          </PermissionGate>
        </TabsContent>

        {/* TAB 4: Check-in */}
        <TabsContent value="checkin" className="mt-4">
          <Card className="p-6 text-center">
            <Users className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="font-medium">Check-in will be available when the event starts</p>
            <p className="text-sm text-muted-foreground mt-1">You can test the QR scanner before the event begins.</p>
            <Link href={`/admin/org/events/${eventId}/check-in`} className={cn(buttonVariants({ variant: "outline" }), "mt-3 gap-2")}>
              Test Scanner
            </Link>
          </Card>
        </TabsContent>

        {/* TAB 5: Announcements */}
        <TabsContent value="announcements" className="mt-4">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium">Announcements</h3>
              <PermissionGate permission={PERMISSIONS.COMMUNICATION_SEND_ANNOUNCEMENT}>
                <Button size="sm" className="gap-1"><Megaphone className="h-3.5 w-3.5" /> New Announcement</Button>
              </PermissionGate>
            </div>
            <p className="text-sm text-muted-foreground text-center py-8">
              No announcements yet. Post updates to keep participants informed.
            </p>
          </Card>
        </TabsContent>

        {/* TAB 6: Team */}
        <TabsContent value="team" className="mt-4">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium">Event Team</h3>
              <PermissionGate permission={PERMISSIONS.MEMBER_INVITE}>
                <Button size="sm" className="gap-1"><UserPlus className="h-3.5 w-3.5" /> Add Team Member</Button>
              </PermissionGate>
            </div>
            <p className="text-sm text-muted-foreground text-center py-8">
              No team members assigned yet. Add coordinators and volunteers.
            </p>
          </Card>
        </TabsContent>

        {/* TAB 7: Settings */}
        <TabsContent value="settings" className="mt-4 space-y-4">
          <Card className="p-6 space-y-4">
            <h3 className="text-sm font-medium">Registration Settings</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Approval Required</span><Badge variant="outline">No</Badge></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Waitlist</span><Badge variant="outline">Disabled</Badge></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Team Registration</span><Badge variant="outline">Disabled</Badge></div>
            </div>
          </Card>
          <Card className="p-6 space-y-4">
            <h3 className="text-sm font-medium">Visibility</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Visibility</span><Badge variant="outline">Public</Badge></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Featured</span><Badge variant="outline">No</Badge></div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
