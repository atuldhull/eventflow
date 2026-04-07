"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"
import {
  Calendar, MapPin, Monitor, Users, Clock, Share2, Tag, Globe, Ticket,
  ChevronDown, ChevronUp, Loader2, Building2, Mail, Phone, ExternalLink,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Button, buttonVariants } from "@/components/ui/button"
import { ShareModal } from "@/components/events/ShareModal"
import { AddToCalendar } from "@/components/events/AddToCalendar"
import { CountdownTimer } from "@/components/events/CountdownTimer"
import { cn } from "@/lib/utils"

interface EventData {
  id: string; title: string; slug: string; description: string; shortDescription: string
  status: string; type: string; visibility: string; category: string; tags: string[]
  startDate: string; endDate: string; timezone: string
  registrationStartDate: string | null; registrationEndDate: string | null
  venue: string | null; venueAddress: string | null; venueCity: string | null
  venueState: string | null; venueCountry: string | null
  isOnline: boolean; onlinePlatform: string | null
  coverImage: string | null; gallery: string[]
  maxCapacity: number | null; currentRegistrations: number
  waitlistEnabled: boolean; approvalRequired: boolean
  allowTeamRegistration: boolean; minTeamSize: number | null; maxTeamSize: number | null
  isPaid: boolean; rules: string | null; termsAndConditions: string | null
  refundPolicy: string | null; contactEmail: string | null; contactPhone: string | null
  isFeatured: boolean
  organization: { id: string; name: string; logo: string | null; description: string | null; slug: string }
  ticketTypes: { id: string; name: string; description: string | null; price: number; currency: string; quantity: number | null; sold: number; maxPerUser: number }[]
  sessions: { id: string; title: string; description: string | null; speaker: string | null; speakerBio: string | null; startTime: string; endTime: string; venue: string | null; track: string | null }[]
  sponsors: { id: string; name: string; logo: string | null; website: string | null; tier: string }[]
  faqs: { id: string; question: string; answer: string }[]
}

const statusConfig: Record<string, { label: string; color: string; dot: string }> = {
  PUBLISHED: { label: "Upcoming", color: "bg-blue-100 text-blue-700", dot: "bg-blue-500" },
  REGISTRATION_OPEN: { label: "Registration Open", color: "bg-green-100 text-green-700", dot: "bg-green-500" },
  REGISTRATION_CLOSED: { label: "Registration Closed", color: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
  ONGOING: { label: "Happening Now", color: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500 animate-pulse" },
  COMPLETED: { label: "Completed", color: "bg-zinc-100 text-zinc-700", dot: "bg-zinc-500" },
}

export default function PublicEventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const [event, setEvent] = useState<EventData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null)
  const [isCancelled, setIsCancelled] = useState(false)

  useEffect(() => {
    async function fetchEvent() {
      try {
        const res = await fetch(`/api/events/${slug}`)
        const json = await res.json()
        if (json.success) {
          setEvent(json.data)
          if (json.cancelled) setIsCancelled(true)
        } else setNotFound(true)
      } catch { setNotFound(true) }
      finally { setIsLoading(false) }
    }
    fetchEvent()
  }, [slug])

  if (isLoading) return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  if (notFound || !event) return (
    <div className="text-center py-24 space-y-3">
      <Calendar className="mx-auto h-12 w-12 text-muted-foreground/30" />
      <h1 className="text-2xl font-bold">Event Not Found</h1>
      <p className="text-muted-foreground">This event doesn't exist or is no longer available.</p>
      <Link href="/events" className={cn(buttonVariants({ variant: "outline" }), "mt-2")}>Browse Events</Link>
    </div>
  )

  const fmt = (d: string) => new Date(d).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
  const fmtTime = (d: string) => new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
  const fmtShort = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
  const status = statusConfig[event.status] || statusConfig.PUBLISHED
  const eventUrl = typeof window !== "undefined" ? `${window.location.origin}/events/${event.slug}` : ""
  const spotsLeft = event.maxCapacity ? event.maxCapacity - event.currentRegistrations : null
  const isSoldOut = spotsLeft !== null && spotsLeft <= 0
  const registrationNotOpenYet = event.registrationStartDate && new Date(event.registrationStartDate) > new Date()
  const canRegister = ["PUBLISHED", "REGISTRATION_OPEN"].includes(event.status) && !isCancelled && !isSoldOut && !registrationNotOpenYet
  const lowestPrice = event.ticketTypes.length > 0 ? Math.min(...event.ticketTypes.map(t => t.price)) : 0

  return (
    <div>
      {/* Cancelled Banner */}
      {isCancelled && (
        <div className="bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-900">
          <div className="container mx-auto px-4 py-3 text-center text-sm text-red-700 dark:text-red-400 font-medium">
            This event has been cancelled. Registration is no longer available.
          </div>
        </div>
      )}

      {/* Hero */}
      <div className="relative h-64 sm:h-80 lg:h-96 bg-linear-to-br from-primary/20 to-primary/5 overflow-hidden">
        {event.coverImage && <img src={event.coverImage} alt={event.title} className="w-full h-full object-cover absolute inset-0" />}
        <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8 lg:p-12">
          <div className="container mx-auto">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <Badge className={status.color}>{status.label}</Badge>
              <Badge variant="secondary">{event.category}</Badge>
              {event.isFeatured && <Badge className="bg-amber-500 text-white">Featured</Badge>}
              {event.type !== "SINGLE" && <Badge variant="outline" className="border-white/30 text-white">{event.type.replace(/_/g, " ")}</Badge>}
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">{event.title}</h1>
            <p className="text-white/80 mt-2 max-w-2xl text-sm sm:text-base">{event.shortDescription}</p>
            <div className="flex items-center gap-3 mt-3 text-white/70 text-sm">
              <span>by {event.organization.name}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Info Bar */}
      <div className="border-b bg-background/95 backdrop-blur-sm sticky top-16 z-40">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" />{fmtShort(event.startDate)} · {fmtTime(event.startDate)}</span>
            <span className="flex items-center gap-1.5">
              {event.isOnline ? <Monitor className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
              {event.isOnline ? (event.onlinePlatform || "Online") : (event.venue || event.venueCity || "Venue TBA")}
            </span>
            {event.isPaid
              ? <span className="flex items-center gap-1.5"><Ticket className="h-4 w-4" />From ₹{lowestPrice}</span>
              : <span className="flex items-center gap-1.5"><Ticket className="h-4 w-4" />Free</span>}
          </div>
          <div className="flex items-center gap-2">
            <AddToCalendar title={event.title} description={event.shortDescription} startDate={event.startDate} endDate={event.endDate} venue={event.isOnline ? undefined : event.venue} isOnline={event.isOnline} onlinePlatform={event.onlinePlatform} slug={event.slug} />
            <ShareModal url={eventUrl} title={event.title} description={event.shortDescription} />
            {canRegister && (
              <Link href={`/events/${slug}/register`} className={cn(buttonVariants(), "gap-2")}>
                Register Now
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Description */}
            <section>
              <h2 className="text-lg font-semibold mb-3">About This Event</h2>
              <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{event.description}</div>
            </section>

            {/* Tags */}
            {event.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {event.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="gap-1"><Tag className="h-3 w-3" />{tag}</Badge>
                ))}
              </div>
            )}

            <Separator />

            {/* Sessions / Schedule */}
            {event.sessions.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-4">Schedule</h2>
                <div className="space-y-3">
                  {event.sessions.map((s) => (
                    <Card key={s.id} className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <p className="font-medium">{s.title}</p>
                          {s.speaker && <p className="text-sm text-primary">{s.speaker}</p>}
                          {s.description && <p className="text-xs text-muted-foreground">{s.description}</p>}
                          {s.venue && <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{s.venue}</p>}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-medium">{fmtTime(s.startTime)}</p>
                          <p className="text-xs text-muted-foreground">to {fmtTime(s.endTime)}</p>
                          {s.track && <Badge variant="outline" className="text-[10px] mt-1">{s.track}</Badge>}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {/* Sponsors */}
            {event.sponsors.length > 0 && (
              <>
                <Separator />
                <section>
                  <h2 className="text-lg font-semibold mb-4">Sponsors</h2>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {event.sponsors.map((sp) => (
                      <Card key={sp.id} className="p-4 flex items-center gap-3">
                        {sp.logo ? (
                          <img src={sp.logo} alt={sp.name} className="h-10 w-10 rounded-md object-contain" />
                        ) : (
                          <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">{sp.name[0]}</div>
                        )}
                        <div>
                          <p className="text-sm font-medium">{sp.name}</p>
                          <Badge variant="outline" className="text-[10px]">{sp.tier}</Badge>
                        </div>
                        {sp.website && (
                          <a href={sp.website} target="_blank" rel="noopener noreferrer" className="ml-auto text-muted-foreground hover:text-foreground">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </Card>
                    ))}
                  </div>
                </section>
              </>
            )}

            {/* FAQs */}
            {event.faqs.length > 0 && (
              <>
                <Separator />
                <section>
                  <h2 className="text-lg font-semibold mb-4">FAQs</h2>
                  <div className="space-y-2">
                    {event.faqs.map((faq) => (
                      <Card key={faq.id} className="overflow-hidden">
                        <button
                          onClick={() => setExpandedFaq(expandedFaq === faq.id ? null : faq.id)}
                          className="w-full flex items-center justify-between p-4 text-left"
                        >
                          <span className="text-sm font-medium">{faq.question}</span>
                          {expandedFaq === faq.id ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
                        </button>
                        {expandedFaq === faq.id && (
                          <div className="px-4 pb-4">
                            <p className="text-sm text-muted-foreground">{faq.answer}</p>
                          </div>
                        )}
                      </Card>
                    ))}
                  </div>
                </section>
              </>
            )}

            {/* Rules */}
            {event.rules && (
              <>
                <Separator />
                <section>
                  <h2 className="text-lg font-semibold mb-3">Rules & Guidelines</h2>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{event.rules}</p>
                </section>
              </>
            )}

            {/* Terms */}
            {event.termsAndConditions && (
              <section>
                <h2 className="text-lg font-semibold mb-3">Terms & Conditions</h2>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{event.termsAndConditions}</p>
              </section>
            )}

            {event.refundPolicy && (
              <section>
                <h2 className="text-lg font-semibold mb-3">Refund Policy</h2>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{event.refundPolicy}</p>
              </section>
            )}
          </div>

          {/* Sidebar */}
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
                        <p className="font-bold">{tt.price === 0 ? "Free" : `₹${tt.price.toLocaleString("en-IN")}`}</p>
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

              {canRegister ? (
                <Link href={`/events/${slug}/register`} className={cn(buttonVariants(), "w-full")}>
                  {event.isPaid ? `Register · From ₹${lowestPrice}` : "Register for Free"}
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
                  Team registration · {event.minTeamSize}–{event.maxTeamSize} members
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
                    <p className="font-medium text-foreground">{fmt(event.startDate)}</p>
                    <p>{fmtTime(event.startDate)} – {fmtTime(event.endDate)}</p>
                    {event.startDate.slice(0,10) !== event.endDate.slice(0,10) && <p>to {fmt(event.endDate)}</p>}
                  </div>
                </div>
                {event.registrationEndDate && (
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4 mt-0.5 shrink-0" />
                    <div>
                      <p>Registration closes</p>
                      <p className="font-medium text-foreground">{fmt(event.registrationEndDate)}</p>
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

            {/* Calendar & Share */}
            <AddToCalendar title={event.title} description={event.shortDescription} startDate={event.startDate} endDate={event.endDate} venue={event.isOnline ? undefined : event.venue} isOnline={event.isOnline} onlinePlatform={event.onlinePlatform} slug={event.slug} className="w-full" />
            <ShareModal url={eventUrl} title={event.title} description={event.shortDescription} trigger={
              <Button variant="outline" className="w-full gap-2"><Share2 className="h-4 w-4" /> Share This Event</Button>
            } />
          </div>
        </div>
      </div>
    </div>
  )
}
