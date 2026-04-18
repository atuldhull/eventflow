"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Calendar, Tag, Loader2, Eye } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { buttonVariants } from "@/components/ui/button"
import { EventDiscussion } from "@/components/events/EventDiscussion"
import { EventHero } from "@/components/events/detail/EventHero"
import { EventStickyBar } from "@/components/events/detail/EventStickyBar"
import { EventSchedule } from "@/components/events/detail/EventSchedule"
import { EventSponsors } from "@/components/events/detail/EventSponsors"
import { EventFAQs } from "@/components/events/detail/EventFAQs"
import { EventSidebar } from "@/components/events/detail/EventSidebar"
import type { EventData } from "@/components/events/detail/types"
import { cn } from "@/lib/utils"

export default function PublicEventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const searchParams = useSearchParams()
  const isPreviewMode = searchParams.get("preview") === "1"
  const [event, setEvent] = useState<EventData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [isCancelled, setIsCancelled] = useState(false)
  const [previewStatus, setPreviewStatus] = useState<string | null>(null)

  useEffect(() => {
    async function fetchEvent() {
      try {
        const url = isPreviewMode ? `/api/events/${slug}?preview=1` : `/api/events/${slug}`
        const res = await fetch(url)
        const json = await res.json()
        if (json.success) {
          setEvent(json.data)
          if (json.cancelled) setIsCancelled(true)
          if (json.preview?.status) setPreviewStatus(json.preview.status)
        } else setNotFound(true)
      } catch { setNotFound(true) }
      finally { setIsLoading(false) }
    }
    fetchEvent()
  }, [slug, isPreviewMode])

  if (isLoading) return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  if (notFound || !event) return (
    <div className="text-center py-24 space-y-3">
      <Calendar className="mx-auto h-12 w-12 text-muted-foreground/30" />
      <h1 className="text-2xl font-bold">Event Not Found</h1>
      <p className="text-muted-foreground">This event doesn&apos;t exist or is no longer available.</p>
      <Link href="/events" className={cn(buttonVariants({ variant: "outline" }), "mt-2")}>Browse Events</Link>
    </div>
  )

  const eventUrl = typeof window !== "undefined" ? `${window.location.origin}/events/${event.slug}` : ""
  const spotsLeft = event.maxCapacity ? event.maxCapacity - event.currentRegistrations : null
  const isSoldOut = spotsLeft !== null && spotsLeft <= 0
  const registrationNotOpenYet = !!(event.registrationStartDate && new Date(event.registrationStartDate) > new Date())
  const canRegister = ["PUBLISHED", "REGISTRATION_OPEN"].includes(event.status) && !isCancelled && !isSoldOut && !registrationNotOpenYet
  const lowestPrice = event.ticketTypes.length > 0 ? Math.min(...event.ticketTypes.map(t => t.price)) : 0

  return (
    <div>
      {/* Preview Banner */}
      {previewStatus && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-3 text-sm text-amber-800 dark:text-amber-300">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 shrink-0" />
              <span className="font-medium">Preview mode</span>
              <span className="text-amber-700/80 dark:text-amber-400/80">
                You&apos;re viewing this event as an attendee would. Status: {previewStatus.replace(/_/g, " ")}.
              </span>
            </div>
            <Link
              href={`/admin/org/events`}
              className="text-xs font-medium underline hover:no-underline whitespace-nowrap"
            >
              Back to admin
            </Link>
          </div>
        </div>
      )}

      {/* Cancelled Banner */}
      {isCancelled && (
        <div className="bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-900">
          <div className="container mx-auto px-4 py-3 text-center text-sm text-red-700 dark:text-red-400 font-medium">
            This event has been cancelled. Registration is no longer available.
          </div>
        </div>
      )}

      <EventHero event={event} />
      <EventStickyBar event={event} eventUrl={eventUrl} canRegister={canRegister} lowestPrice={lowestPrice} />

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

            {event.sessions.length > 0 && (<><Separator /><EventSchedule sessions={event.sessions} /></>)}
            {event.sponsors.length > 0 && (<><Separator /><EventSponsors sponsors={event.sponsors} /></>)}
            {event.faqs.length > 0 && (<><Separator /><EventFAQs faqs={event.faqs} /></>)}

            <Separator />
            <EventDiscussion slug={slug} />

            {/* Rules */}
            {event.rules && (
              <>
                <Separator />
                <section>
                  <h2 className="text-lg font-semibold mb-3">Rules &amp; Guidelines</h2>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{event.rules}</p>
                </section>
              </>
            )}

            {/* Terms */}
            {event.termsAndConditions && (
              <section>
                <h2 className="text-lg font-semibold mb-3">Terms &amp; Conditions</h2>
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
          <EventSidebar
            event={event}
            eventUrl={eventUrl}
            canRegister={canRegister}
            isCancelled={isCancelled}
            isSoldOut={isSoldOut}
            registrationNotOpenYet={registrationNotOpenYet}
            spotsLeft={spotsLeft}
            lowestPrice={lowestPrice}
          />
        </div>
      </div>
    </div>
  )
}
