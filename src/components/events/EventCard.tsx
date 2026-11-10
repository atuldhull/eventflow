import Link from "next/link"
import { Calendar, MapPin, Monitor } from "lucide-react"
import { Pill } from "@/components/ui/pill"
import { Skeleton } from "@/components/ui/skeleton"
import { SaveEventButton } from "@/components/events/SaveEventButton"
import { cn } from "@/lib/utils"
import { priceLabel, type EventPriceSummary } from "@/lib/public-events"

export interface EventCardEvent {
  id: string
  slug: string
  title: string
  shortDescription?: string | null
  coverImage?: string | null
  category?: string | null
  startDate: string
  /** past its end date (from the API): never shown as live, even if its status lags */
  hasEnded?: boolean
  venue?: string | null
  venueCity?: string | null
  isOnline: boolean
  isPaid: boolean
  /** visible ticket prices (from the API); without it the card falls back to Free / Paid */
  price?: EventPriceSummary | null
  currentRegistrations: number
  maxCapacity?: number | null
  status: string
  isFeatured?: boolean
  organization?: { name: string } | null
}

interface EventCardProps {
  event: EventCardEvent
  variant?: "default" | "compact"
  /** show the save (heart) button on the cover */
  showSave?: boolean
}

/**
 * The event card used wherever events are browsed: the cover (or a date plate
 * when there's no photo), organiser · category, title, when, where, and price.
 * The title link stretches over the card; the heart sits above it so the two
 * never nest.
 */
export function EventCard({ event, variant = "default", showSave = false }: EventCardProps) {
  const start = new Date(event.startDate)
  const date = start.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })
  const time = start.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
  const spotsLeft = event.maxCapacity ? event.maxCapacity - event.currentRegistrations : null
  const isAlmostFull = spotsLeft !== null && spotsLeft <= 10 && spotsLeft > 0
  const isFull = spotsLeft !== null && spotsLeft <= 0
  const isLive = event.status === "ONGOING" && !event.hasEnded
  const isEnded = event.status === "COMPLETED" || !!event.hasEnded

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-lg border bg-card transition-colors hover:border-input has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring">
      <div className="relative aspect-[16/10] overflow-hidden border-b border-rule bg-raised">
        {event.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.coverImage} alt="" className="size-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.015]" />
        ) : (
          <div aria-hidden className="flex size-full flex-col items-center justify-center leading-none">
            <span className="text-[13px] text-muted-foreground">{start.toLocaleDateString("en-IN", { month: "short" })}</span>
            <span className="mt-1.5 text-[40px] font-semibold tracking-[-0.03em] tabular-nums">{start.getDate()}</span>
            <span className="mt-1.5 text-[13px] text-muted-foreground">{start.toLocaleDateString("en-IN", { weekday: "long" })}</span>
          </div>
        )}
        {(isLive || event.isFeatured) && (
          <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
            {isLive && <Pill tone="positive" live>Live now</Pill>}
            {event.isFeatured && <Pill tone="neutral">Featured</Pill>}
          </div>
        )}
        {showSave && (
          <div className="absolute top-2.5 right-2.5 z-10">
            <SaveEventButton eventId={event.id} />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <p className="flex min-w-0 items-center gap-1.5 text-[13px] text-muted-foreground">
          {event.organization && <span className="truncate">{event.organization.name}</span>}
          {event.organization && event.category && <span aria-hidden>·</span>}
          {event.category && <span className="shrink-0">{event.category}</span>}
        </p>
        <h3 className="mt-1.5 line-clamp-2 text-[15px] leading-snug font-semibold tracking-[-0.005em]">
          <Link
            href={`/events/${event.slug}`}
            className="outline-none after:absolute after:inset-0 after:content-[''] group-hover:underline group-hover:decoration-border group-hover:underline-offset-4"
          >
            {event.title}
          </Link>
        </h3>
        {variant !== "compact" && event.shortDescription && (
          <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">{event.shortDescription}</p>
        )}

        <div className="mt-3 space-y-1 text-[13px] text-muted-foreground">
          <p className="flex items-center gap-1.5">
            <Calendar className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate tabular-nums">{date} · {time}</span>
          </p>
          <p className="flex items-center gap-1.5">
            {event.isOnline ? <Monitor className="size-3.5 shrink-0" aria-hidden /> : <MapPin className="size-3.5 shrink-0" aria-hidden />}
            <span className="truncate">{event.isOnline ? "Online event" : (event.venue || event.venueCity || "Venue TBA")}</span>
          </p>
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 pt-4">
          <span className="text-sm font-medium tabular-nums">{priceLabel(event.price, event.isPaid)}</span>
          <span className="flex min-w-0 items-center gap-2 text-[13px] text-muted-foreground">
            {isFull ? (
              <Pill tone="neutral">Sold out</Pill>
            ) : isAlmostFull ? (
              <Pill tone="warning">{spotsLeft} spot{spotsLeft !== 1 ? "s" : ""} left</Pill>
            ) : isEnded ? (
              <Pill tone="neutral">Ended</Pill>
            ) : null}
            <span className="truncate tabular-nums">{event.currentRegistrations.toLocaleString("en-IN")} registered</span>
          </span>
        </div>
      </div>
    </article>
  )
}

/** Loading placeholder with the card's real proportions. */
export function EventCardSkeleton() {
  return (
    <div className={cn("flex flex-col overflow-hidden rounded-lg border bg-card")}>
      <Skeleton className="aspect-[16/10] rounded-none" />
      <div className="space-y-2.5 p-4">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-3.5 w-3/5" />
        <Skeleton className="h-3.5 w-2/5" />
        <div className="flex justify-between pt-3">
          <Skeleton className="h-4 w-10" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
    </div>
  )
}
