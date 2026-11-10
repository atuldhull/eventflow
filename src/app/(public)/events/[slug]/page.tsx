"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ChevronRight, Eye, XCircle } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { EventDiscussion } from "@/components/events/EventDiscussion"
import { VenueMap } from "@/components/events/VenueMap"
import { EventHero, EventPoster } from "@/components/events/detail/EventHero"
import { EventStickyBar } from "@/components/events/detail/EventStickyBar"
import { EventSchedule, EventSpeakers } from "@/components/events/detail/EventSchedule"
import { EventSponsors } from "@/components/events/detail/EventSponsors"
import { EventFAQs } from "@/components/events/detail/EventFAQs"
import { EventSidebar } from "@/components/events/detail/EventSidebar"
import { EventOrganizer } from "@/components/events/detail/EventOrganizer"
import { EventSection } from "@/components/events/detail/EventSection"
import { EventAnnouncements } from "@/components/events/detail/EventAnnouncements"
import type { EventData } from "@/components/events/detail/types"
import { statusLabel } from "@/lib/status-tone"

const CTA_ID = "event-register-cta"
const SHELL = "mx-auto w-full max-w-[1240px] px-5 sm:px-8"

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

  if (isLoading) return <EventPageSkeleton />
  if (notFound || !event) return (
    <div className={`${SHELL} py-20`}>
      <div className="mx-auto max-w-md rounded-lg border border-dashed px-6 py-14 text-center">
        <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.015em]">Event not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">This event doesn&apos;t exist or is no longer available.</p>
        <Link href="/events" className={`${buttonVariants({ variant: "outline" })} mt-6`}>Browse events</Link>
      </div>
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
      {/* Preview banner (organisers looking at a draft) */}
      {previewStatus && (
        <div className="border-b bg-raised">
          <div className={`${SHELL} flex flex-col gap-2 py-3 text-sm sm:flex-row sm:items-center sm:justify-between`}>
            <p className="flex items-start gap-2 text-muted-foreground">
              <Eye className="mt-0.5 size-4 shrink-0 text-foreground" aria-hidden />
              <span>
                <span className="font-medium text-foreground">Preview mode.</span>{" "}
                You&apos;re viewing this event as an attendee would. Status: {statusLabel(previewStatus)}.
              </span>
            </p>
            <Link href={`/admin/org/events`} className="shrink-0 pl-6 text-[13px] font-medium underline underline-offset-4 hover:text-brand sm:pl-0">
              Back to admin
            </Link>
          </div>
        </div>
      )}

      {/* Cancelled banner */}
      {isCancelled && (
        <div className="border-b border-destructive/15 bg-pill-negative text-pill-negative-foreground">
          <p className={`${SHELL} flex items-center gap-2 py-3 text-sm font-medium`}>
            <XCircle className="size-4 shrink-0" aria-hidden />
            This event has been cancelled. Registration is no longer available.
          </p>
        </div>
      )}

      <div className={`${SHELL} pt-5 pb-16 lg:pt-8 lg:pb-24`}>
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-[13px] text-muted-foreground">
          <Link href="/events" className="rounded-sm transition-colors hover:text-foreground">Events</Link>
          <ChevronRight className="size-3.5 shrink-0 text-faint" aria-hidden />
          {event.organization.slug ? (
            <Link href={`/org/${event.organization.slug}`} className="truncate rounded-sm text-foreground transition-colors hover:text-brand">{event.organization.name}</Link>
          ) : (
            <span className="truncate text-foreground">{event.organization.name}</span>
          )}
        </nav>

        {/* Phone order: poster, title, ticket stub, content, organizer, discussion.
            Desktop: the poster across the top, content on the left, the ticket stub sticky on the right. */}
        <div className="mt-4 lg:mt-5">
          <EventPoster event={event} />
        </div>

        <div className={`${event.coverImage ? "mt-12" : "mt-8"} grid gap-y-10 lg:mt-12 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-x-12 xl:gap-x-16`}>
          <div className="min-w-0 lg:col-start-1 lg:row-start-1">
            <EventHero event={event} />
          </div>

          <div className="lg:col-start-2 lg:row-span-4 lg:row-start-1">
            <EventSidebar
              event={event}
              eventUrl={eventUrl}
              canRegister={canRegister}
              isCancelled={isCancelled}
              isSoldOut={isSoldOut}
              registrationNotOpenYet={registrationNotOpenYet}
              spotsLeft={spotsLeft}
              lowestPrice={lowestPrice}
              ctaId={CTA_ID}
            />
          </div>

          <div className="min-w-0 space-y-14 lg:col-start-1 lg:row-start-2">
            <EventSection id="about" title="About this event">
              <div className="max-w-[66ch] text-[17px] leading-8 whitespace-pre-wrap text-foreground/90">{event.description}</div>
              {event.tags.length > 0 && (
                <ul className="mt-5 flex flex-wrap gap-1.5" aria-label="Tags">
                  {event.tags.map((tag) => (
                    <li key={tag} className="rounded-full border px-3 py-1 text-[13px] font-medium text-muted-foreground">#{tag}</li>
                  ))}
                </ul>
              )}
            </EventSection>

            <EventAnnouncements slug={slug} timeZone={event.timezone} />
            <EventSchedule sessions={event.sessions} timeZone={event.timezone} />
            <EventSpeakers sessions={event.sessions} />
            <EventSponsors sponsors={event.sponsors} />
            <EventFAQs faqs={event.faqs} />

            {/* A hybrid event has a venue even though it also runs online. */}
            {(!event.isOnline || event.type === "HYBRID") && event.venue && (
              <EventSection id="venue" title="Venue">
                <VenueMap
                  venue={event.venue}
                  address={event.venueAddress}
                  city={event.venueCity}
                  state={event.venueState}
                  country={event.venueCountry}
                  latitude={event.venueLatitude}
                  longitude={event.venueLongitude}
                />
              </EventSection>
            )}

            {event.rules && (
              <EventSection id="rules" title="Rules and guidelines">
                <p className="max-w-[68ch] rounded-[22px] border bg-card p-5 text-[15px] leading-relaxed whitespace-pre-wrap text-muted-foreground sm:p-6">{event.rules}</p>
              </EventSection>
            )}
            {event.termsAndConditions && (
              <EventSection id="terms" title="Terms and conditions">
                <p className="max-w-[68ch] rounded-[22px] border bg-card p-5 text-[15px] leading-relaxed whitespace-pre-wrap text-muted-foreground sm:p-6">{event.termsAndConditions}</p>
              </EventSection>
            )}
            {event.refundPolicy && (
              <EventSection id="refunds" title="Refund policy">
                <p className="max-w-[68ch] rounded-[22px] border bg-card p-5 text-[15px] leading-relaxed whitespace-pre-wrap text-muted-foreground sm:p-6">{event.refundPolicy}</p>
              </EventSection>
            )}
          </div>

          <div className="min-w-0 lg:col-start-1 lg:row-start-3">
            <EventOrganizer event={event} />
          </div>

          <div className="min-w-0 lg:col-start-1 lg:row-start-4">
            <EventDiscussion slug={slug} />
          </div>
        </div>
      </div>

      <EventStickyBar event={event} canRegister={canRegister} lowestPrice={lowestPrice} watchId={CTA_ID} />
    </div>
  )
}

function EventPageSkeleton() {
  return (
    <div className={`${SHELL} pt-5 pb-16 lg:pt-8`} aria-busy="true" aria-label="Loading event">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-5 aspect-[4/3] w-full rounded-[28px] sm:aspect-[16/9] lg:aspect-[5/2]" />
      <div className="mt-10 grid gap-8 lg:mt-12 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-x-12 xl:gap-x-16">
        <div>
          <Skeleton className="h-4 w-48" />
          <Skeleton className="mt-3 h-14 w-3/4" />
          <Skeleton className="mt-3 h-4 w-2/3" />
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-24 rounded-[22px]" />
            <Skeleton className="h-24 rounded-[22px]" />
          </div>
        </div>
        <Skeleton className="h-[460px] rounded-[26px]" />
      </div>
    </div>
  )
}
