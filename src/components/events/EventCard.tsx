import Link from "next/link"
import { Calendar, MapPin, Monitor } from "lucide-react"
import { Pill } from "@/components/ui/pill"
import { Skeleton } from "@/components/ui/skeleton"
import { SaveEventButton } from "@/components/events/SaveEventButton"
import { Perforation, PosterPattern, posterSeed, posterTheme } from "@/components/events/poster"
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

const categoryLabel = (c: string) => c.trim().replace(/_/g, " ")

/**
 * The event card used wherever events are browsed, built like a ticket: the cover (or a
 * poster in the event's own brand colour, with the date set huge when there's no photo),
 * a perforated edge, then organiser · category, title, when, where, and price.
 * The title link stretches over the card; the heart sits above it so the two never nest.
 */
export function EventCard({ event, variant = "default", showSave = false }: EventCardProps) {
  const start = new Date(event.startDate)
  const date = start.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })
  const time = start.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
  const month = start.toLocaleDateString("en-IN", { month: "short" })
  const weekday = start.toLocaleDateString("en-IN", { weekday: "long" })
  const spotsLeft = event.maxCapacity ? event.maxCapacity - event.currentRegistrations : null
  const isAlmostFull = spotsLeft !== null && spotsLeft <= 10 && spotsLeft > 0
  const isFull = spotsLeft !== null && spotsLeft <= 0
  const isLive = event.status === "ONGOING" && !event.hasEnded
  const isEnded = event.status === "COMPLETED" || !!event.hasEnded
  const theme = posterTheme(event.slug || event.id)
  // cards lean a touch left or right on hover, decided by the event so a row feels hand-pinned
  const lean = posterSeed(event.id) % 2 ? "motion-safe:hover:rotate-[0.6deg]" : "motion-safe:hover:-rotate-[0.6deg]"

  return (
    <article
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-[22px] border bg-card transition-[transform,box-shadow,border-color] duration-500 ease-[cubic-bezier(.22,1,.36,1)] hover:border-lavender/50 hover:shadow-[0_24px_50px_-24px_rgb(0_0_0/0.45)] motion-safe:hover:-translate-y-1.5 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring",
        lean,
      )}
    >
      <div className={cn("relative aspect-[4/3] overflow-hidden", !event.coverImage && theme.field)}>
        {event.coverImage ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={event.coverImage}
              alt=""
              className="size-full object-cover transition-transform duration-700 ease-[cubic-bezier(.22,1,.36,1)] motion-safe:group-hover:scale-[1.04]"
            />
            {/* a lemon date stamp pinned to the photo */}
            <span
              aria-hidden
              className="font-display absolute bottom-3 left-3 flex flex-col items-center rounded-xl bg-lemon px-3 py-1.5 leading-none text-lemon-ink shadow-lg"
            >
              <span className="text-[24px] font-extrabold tracking-[-0.04em] tabular-nums">{start.getDate()}</span>
              <span className="mt-0.5 text-[11px] font-bold tracking-[0.12em] uppercase">{month}</span>
            </span>
          </>
        ) : (
          <div aria-hidden className="absolute inset-0">
            <PosterPattern seed={event.slug || event.id} className="motion-safe:group-hover:scale-[1.06] motion-safe:group-hover:rotate-[2deg]" />
            {event.category && (
              <span className="absolute bottom-[42%] left-5 max-w-[60%] truncate text-[11px] font-bold tracking-[0.16em] uppercase opacity-80">
                {categoryLabel(event.category)}
              </span>
            )}
            <div className="absolute bottom-4 left-5 flex items-end gap-3">
              <span className="font-display text-[88px] leading-[0.78] font-extrabold tracking-[-0.06em] tabular-nums transition-transform duration-500 motion-safe:group-hover:-translate-y-1 sm:text-[96px]">
                {String(start.getDate()).padStart(2, "0")}
              </span>
              <span className="font-display mb-0.5 flex flex-col leading-none">
                <span className="text-[26px] font-extrabold tracking-[-0.03em] uppercase">{month}</span>
                <span className="mt-1 text-[13px] font-semibold opacity-75">{weekday}</span>
              </span>
            </div>
          </div>
        )}
        {(isLive || event.isFeatured) && (
          <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
            {isLive && <Pill tone="positive" live>Live now</Pill>}
            {event.isFeatured && (
              <span className="pill bg-charcoal text-lemon">Featured</span>
            )}
          </div>
        )}
        {showSave && (
          <div className="absolute top-2.5 right-2.5 z-10">
            <SaveEventButton eventId={event.id} />
          </div>
        )}
      </div>

      <Perforation />

      <div className="flex flex-1 flex-col p-5">
        <p className="flex min-w-0 items-center gap-1.5 text-[13px] text-muted-foreground">
          {event.organization && <span className="truncate">{event.organization.name}</span>}
          {event.organization && event.category && <span aria-hidden>·</span>}
          {event.category && <span className="shrink-0">{event.category}</span>}
        </p>
        <h3 className="font-display mt-1.5 line-clamp-2 text-[20px] leading-[1.15] font-bold tracking-[-0.025em]">
          <Link
            href={`/events/${event.slug}`}
            className="outline-none after:absolute after:inset-0 after:content-[''] group-hover:underline group-hover:decoration-lavender group-hover:decoration-2 group-hover:underline-offset-4"
          >
            {event.title}
          </Link>
        </h3>
        {variant !== "compact" && event.shortDescription && (
          <p className="mt-2 line-clamp-2 text-[14px] leading-relaxed text-muted-foreground">{event.shortDescription}</p>
        )}

        <div className="mt-3.5 space-y-1 text-[13px] text-muted-foreground">
          <p className="flex items-center gap-1.5">
            <Calendar className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate tabular-nums">{date} · {time}</span>
          </p>
          <p className="flex items-center gap-1.5">
            {event.isOnline ? <Monitor className="size-3.5 shrink-0" aria-hidden /> : <MapPin className="size-3.5 shrink-0" aria-hidden />}
            <span className="truncate">{event.isOnline ? "Online event" : (event.venue || event.venueCity || "Venue TBA")}</span>
          </p>
        </div>

        <div className="mt-auto flex items-end justify-between gap-3 pt-5">
          <span className="font-display text-[20px] leading-none font-extrabold tracking-[-0.03em] tabular-nums">
            {priceLabel(event.price, event.isPaid)}
          </span>
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
    <div className="flex flex-col overflow-hidden rounded-[22px] border bg-card">
      <Skeleton className="aspect-[4/3] rounded-none" />
      <Perforation />
      <div className="space-y-2.5 p-5">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-3.5 w-3/5" />
        <Skeleton className="h-3.5 w-2/5" />
        <div className="flex justify-between pt-4">
          <Skeleton className="h-5 w-14" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
    </div>
  )
}
