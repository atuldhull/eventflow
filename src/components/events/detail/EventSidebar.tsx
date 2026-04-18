"use client"

import Link from "next/link"
import { Calendar, Clock, MapPin, Monitor, Globe, Building2, Mail, Phone, Users, Share2, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { CountdownTimer } from "@/components/events/CountdownTimer"
import { VenueMap } from "@/components/events/VenueMap"
import { AddToCalendar } from "@/components/events/AddToCalendar"
import { ShareModal } from "@/components/events/ShareModal"
import { SaveEventButton } from "@/components/events/SaveEventButton"
import { statusConfig, fmtDate, fmtTime, type EventData } from "./types"

interface Props {
  event: EventData
  eventUrl: string
  canRegister: boolean
  isCancelled: boolean
  isSoldOut: boolean
  registrationNotOpenYet: boolean
  spotsLeft: number | null
  lowestPrice: number
}

export function EventSidebar({ event, eventUrl, canRegister, isCancelled, isSoldOut, registrationNotOpenYet, spotsLeft, lowestPrice }: Props) {
  const status = statusConfig[event.status] || statusConfig.PUBLISHED
  const myReg = event.myRegistration
  const isRegistered = !!myReg && myReg.status !== "CANCELLED"
  const regStatusLabel: Record<string, { label: string; color: string }> = {
    CONFIRMED: { label: "You're registered", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
    CHECKED_IN: { label: "Checked in", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
    PENDING: { label: "Pending payment / approval", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
    WAITLISTED: { label: "On the waitlist", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  }

  return (
    <div className="space-y-4">
      {/* Countdown Timer */}
      {canRegister && new Date(event.startDate) > new Date() && (
        <CountdownTimer targetDate={event.startDate} />
      )}

      {/* Registration Card */}
      <Card className="p-6 space-y-4 sticky top-36">
        <div className="flex items-center gap-2">
          <div className={cn("h-2 w-2 rounded-full", status.dot)} />
          <span className="text-sm font-medium">{status.label}</span>
        </div>
        {isRegistered && (
          <div className={cn("flex items-center gap-2 rounded-md p-2.5", regStatusLabel[myReg!.status]?.color || "bg-muted")}>
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium">{regStatusLabel[myReg!.status]?.label || "Registered"}</p>
              <p className="text-[10px] font-mono opacity-80 truncate">#{myReg!.registrationNumber}</p>
            </div>
          </div>
        )}
        <Separator />

        {/* Ticket Prices */}
        {event.ticketTypes.length > 0 ? (
          <div className="space-y-2">
            {event.ticketTypes.map((tt) => {
              const remaining = tt.quantity ? tt.quantity - tt.sold : null
              return (
                <div key={tt.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium">{tt.name}</p>
                    {tt.description && <p className="text-xs text-muted-foreground">{tt.description}</p>}
                    {remaining !== null && remaining <= 10 && remaining > 0 && (
                      <p className="text-xs text-red-500">{remaining} left</p>
                    )}
                  </div>
                  <p className="font-bold">{tt.price === 0 ? "Free" : `\u20B9${tt.price.toLocaleString("en-IN")}`}</p>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-sm font-medium">{event.isPaid ? "Paid Event" : "Free Event"}</p>
        )}

        {/* Capacity */}
        {event.maxCapacity && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{event.currentRegistrations} registered</span>
              <span>{spotsLeft} spots left</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all", (event.currentRegistrations / event.maxCapacity) > 0.9 ? "bg-red-500" : "bg-green-500")}
                style={{ width: `${Math.min((event.currentRegistrations / event.maxCapacity) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}

        {isRegistered ? (
          <Link href="/dashboard/tickets" className={cn(buttonVariants(), "w-full gap-2")}>
            View my ticket
          </Link>
        ) : canRegister ? (
          <Link href={`/events/${event.slug}/register`} className={cn(buttonVariants(), "w-full")}>
            {event.isPaid ? `Register \u00B7 From \u20B9${lowestPrice}` : "Register for Free"}
          </Link>
        ) : isCancelled ? (
          <Button disabled className="w-full bg-red-100 text-red-700">Event Cancelled</Button>
        ) : isSoldOut ? (
          <Button disabled className="w-full">Sold Out</Button>
        ) : registrationNotOpenYet ? (
          <div className="text-center space-y-1">
            <Button disabled className="w-full">Registration Not Open</Button>
            <p className="text-xs text-muted-foreground">Opens on {new Date(event.registrationStartDate!).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
          </div>
        ) : event.status === "COMPLETED" ? (
          <Button disabled className="w-full">Event Ended</Button>
        ) : (
          <Button disabled className="w-full">Registration Closed</Button>
        )}

        {event.approvalRequired && <p className="text-xs text-center text-muted-foreground">Registration requires approval</p>}
        {event.waitlistEnabled && spotsLeft !== null && spotsLeft <= 0 && <p className="text-xs text-center text-amber-600">Waitlist available</p>}
        {event.allowTeamRegistration && (
          <p className="text-xs text-center text-muted-foreground">
            Team registration &middot; {event.minTeamSize}&ndash;{event.maxTeamSize} members
          </p>
        )}
      </Card>

      {/* Event Details Card */}
      <Card className="p-6 space-y-3">
        <h3 className="text-sm font-medium">Event Details</h3>
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-foreground">{fmtDate(event.startDate)}</p>
              <p>{fmtTime(event.startDate)} &ndash; {fmtTime(event.endDate)}</p>
              {event.startDate.slice(0, 10) !== event.endDate.slice(0, 10) && <p>to {fmtDate(event.endDate)}</p>}
            </div>
          </div>
          {event.registrationEndDate && (
            <div className="flex items-start gap-2 text-muted-foreground">
              <Clock className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <p>Registration closes</p>
                <p className="font-medium text-foreground">{fmtDate(event.registrationEndDate)}</p>
              </div>
            </div>
          )}
          <div className="flex items-start gap-2 text-muted-foreground">
            {event.isOnline ? <Monitor className="h-4 w-4 mt-0.5 shrink-0" /> : <MapPin className="h-4 w-4 mt-0.5 shrink-0" />}
            <div>
              {event.isOnline ? (
                <p className="font-medium text-foreground">{event.onlinePlatform || "Online Event"}</p>
              ) : (
                <>
                  <p className="font-medium text-foreground">{event.venue || "Venue TBA"}</p>
                  {event.venueAddress && <p>{event.venueAddress}</p>}
                  <p>{[event.venueCity, event.venueState, event.venueCountry].filter(Boolean).join(", ")}</p>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Globe className="h-4 w-4 shrink-0" />
            <span>{event.timezone}</span>
          </div>
        </div>
      </Card>

      {/* Who's Going */}
      {event.currentRegistrations > 0 && event.visibility === "PUBLIC" && (
        <Card className="p-6 space-y-3">
          <h3 className="text-sm font-medium">{event.currentRegistrations} {event.currentRegistrations === 1 ? "person" : "people"} registered</h3>
          <div className="flex -space-x-2">
            {Array.from({ length: Math.min(event.currentRegistrations, 8) }).map((_, i) => (
              <div key={i} className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-primary/10 text-xs font-medium text-primary">
                {String.fromCharCode(65 + (i % 26))}
              </div>
            ))}
            {event.currentRegistrations > 8 && (
              <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-muted text-xs font-medium">+{event.currentRegistrations - 8}</div>
            )}
          </div>
        </Card>
      )}

      {/* Venue Map */}
      {!event.isOnline && event.venue && (
        <VenueMap venue={event.venue} address={event.venueAddress} city={event.venueCity} state={event.venueState} country={event.venueCountry} />
      )}

      {/* Organizer Card */}
      <Card className="p-6 space-y-3">
        <h3 className="text-sm font-medium">Organizer</h3>
        <div className="flex items-center gap-3">
          {event.organization.logo ? (
            <img src={event.organization.logo} alt={event.organization.name} className="h-10 w-10 rounded-lg object-cover" />
          ) : (
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
          )}
          <div>
            <p className="font-medium text-sm">{event.organization.name}</p>
            {event.organization.description && (
              <p className="text-xs text-muted-foreground line-clamp-2">{event.organization.description}</p>
            )}
          </div>
        </div>
        <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => { toast.success(`You'll be notified about events from ${event.organization.name}`) }}>
          <Users className="h-3.5 w-3.5" /> Follow {event.organization.name}
        </Button>
        {(event.contactEmail || event.contactPhone) && (
          <>
            <Separator />
            <div className="space-y-1.5">
              {event.contactEmail && (
                <a href={`mailto:${event.contactEmail}`} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
                  <Mail className="h-3 w-3" />{event.contactEmail}
                </a>
              )}
              {event.contactPhone && (
                <a href={`tel:${event.contactPhone}`} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
                  <Phone className="h-3 w-3" />{event.contactPhone}
                </a>
              )}
            </div>
          </>
        )}
      </Card>

      {/* Calendar, Save & Share */}
      <AddToCalendar title={event.title} description={event.shortDescription} startDate={event.startDate} endDate={event.endDate} venue={event.isOnline ? undefined : event.venue} isOnline={event.isOnline} onlinePlatform={event.onlinePlatform} slug={event.slug} className="w-full" />
      <SaveEventButton eventId={event.id} variant="button" />
      <ShareModal url={eventUrl} title={event.title} description={event.shortDescription} trigger={
        <Button variant="outline" className="w-full gap-2"><Share2 className="h-4 w-4" /> Share This Event</Button>
      } />
    </div>
  )
}
