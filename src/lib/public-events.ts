import type { EventStatus, Prisma } from "@prisma/client"
import { z } from "zod/v4"

/**
 * What the public site may list: events anyone can discover. UNLISTED events are
 * reachable by their link only, PRIVATE and INVITE_ONLY ones never appear, and drafts,
 * pending, cancelled and postponed events stay out of every listing.
 */
export const LISTED_EVENT_STATUSES: readonly EventStatus[] = ["PUBLISHED", "REGISTRATION_OPEN", "ONGOING", "COMPLETED"]

/** Statuses an upcoming list may show (a completed event is never "upcoming"). */
export const UPCOMING_EVENT_STATUSES: readonly EventStatus[] = ["PUBLISHED", "REGISTRATION_OPEN", "ONGOING"]

export function publicListingWhere(statuses: readonly EventStatus[] = LISTED_EVENT_STATUSES): Prisma.EventWhereInput {
  return {
    deletedAt: null,
    visibility: "PUBLIC",
    status: { in: [...statuses] },
    ...liveWorkspaceWhere(),
  }
}

/**
 * The event's organization and enterprise (whichever it has, and the organization's own
 * enterprise) are active and not deleted. A deactivated or deleted workspace takes its
 * events off every public surface: listings, search, the sitemap, tenant sites and the
 * event page itself (404).
 */
export function liveWorkspaceWhere(): { AND: Prisma.EventWhereInput[] } {
  return {
    AND: [
      {
        OR: [
          { organizationId: null },
          {
            organization: {
              isActive: true,
              deletedAt: null,
              OR: [{ enterpriseId: null }, { enterprise: { isActive: true, deletedAt: null } }],
            },
          },
        ],
      },
      { OR: [{ enterpriseId: null }, { enterprise: { isActive: true, deletedAt: null } }] },
    ],
  }
}

/**
 * Category filter. Categories are free text: the event wizard stores TEAM_BUILDING,
 * older data says "Hackathon" or "Team building", and the chips send HACKATHON. Match
 * them case-insensitively, treating "_" and " " as the same.
 */
export function categoryWhere(category: string): Prisma.EventWhereInput | null {
  const value = category.trim()
  if (!value || value.toLowerCase() === "all") return null
  const variants = Array.from(new Set([value, value.replace(/_/g, " "), value.replace(/\s+/g, "_")]))
  return { OR: variants.map((v) => ({ category: { equals: v, mode: "insensitive" as const } })) }
}

// Query params arrive as strings; an empty one (?category=) means "not set".
const optionalText = (max: number) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().max(max).optional())

const flag = z
  .enum(["1", "0", "true", "false"])
  .optional()
  .transform((v) => v === "1" || v === "true")

const optionalDate = z.preprocess((v) => (v === "" ? undefined : v), z.coerce.date().optional())

export const MAX_PUBLIC_PAGE_SIZE = 50

export const publicEventsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  // Site sections ask for config.maxEvents, which can exceed the cap: clamp, don't refuse
  limit: z.coerce.number().int().min(1).transform((n) => Math.min(n, MAX_PUBLIC_PAGE_SIZE)).optional(),
  search: optionalText(100),
  category: optionalText(60),
  pricing: z.preprocess((v) => (v === "" ? undefined : v), z.enum(["free", "paid"]).optional()),
  /** only events that haven't ended yet (soonest first) */
  upcoming: flag,
  /** only events that are over (most recent first); ignored together with upcoming */
  past: flag,
  /** one organization's events (tenant-site sections and the calendar module) */
  orgSlug: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string().trim().max(100).regex(/^[a-z0-9][a-z0-9-]*$/i, "Invalid organization").optional(),
  ),
  dateFrom: optionalDate,
  dateTo: optionalDate,
})

export type PublicEventsQuery = z.infer<typeof publicEventsQuerySchema>

/** The full where clause for GET /api/events. */
export function buildPublicEventsWhere(query: PublicEventsQuery, now: Date = new Date()): Prisma.EventWhereInput {
  const and: Prisma.EventWhereInput[] = [publicListingWhere(query.upcoming ? UPCOMING_EVENT_STATUSES : LISTED_EVENT_STATUSES)]

  if (query.search) {
    and.push({
      OR: [
        { title: { contains: query.search, mode: "insensitive" } },
        { category: { contains: query.search, mode: "insensitive" } },
        { tags: { has: query.search } },
      ],
    })
  }
  const category = query.category ? categoryWhere(query.category) : null
  if (category) and.push(category)
  if (query.pricing === "free") and.push({ isPaid: false })
  if (query.pricing === "paid") and.push({ isPaid: true })
  if (query.upcoming) and.push({ endDate: { gte: now } })
  else if (query.past) and.push({ OR: [{ status: "COMPLETED" }, { endDate: { lt: now } }] })
  if (query.orgSlug) and.push({ organization: { slug: query.orgSlug, isActive: true, deletedAt: null } })
  if (query.dateFrom || query.dateTo) {
    and.push({ startDate: { ...(query.dateFrom ? { gte: query.dateFrom } : {}), ...(query.dateTo ? { lte: query.dateTo } : {}) } })
  }

  return { AND: and }
}

/** Upcoming lists read soonest first; a past list most recent first. */
export function publicEventsOrderBy(query: Pick<PublicEventsQuery, "upcoming" | "past">): Prisma.EventOrderByWithRelationInput {
  return !query.upcoming && query.past ? { startDate: "desc" } : { startDate: "asc" }
}

/** The fields an event card shows. Nothing private: no ids beyond the event's own, no contacts. */
export const PUBLIC_EVENT_CARD_SELECT = {
  id: true,
  title: true,
  slug: true,
  shortDescription: true,
  coverImage: true,
  category: true,
  startDate: true,
  endDate: true,
  venue: true,
  venueCity: true,
  isOnline: true,
  isPaid: true,
  currentRegistrations: true,
  maxCapacity: true,
  status: true,
  isFeatured: true,
  organization: { select: { name: true } },
  // The buyable tiers' prices, summarised into `price` by serializeEventCard (not sent as is).
  ticketTypes: { where: { isActive: true, isHidden: false }, select: { price: true } },
} satisfies Prisma.EventSelect

export type PublicEventCardRow = Prisma.EventGetPayload<{ select: typeof PUBLIC_EVENT_CARD_SELECT }>

/** A card's price: the cheapest and dearest visible ticket, and how many tiers there are. */
export type EventPriceSummary = { min: number; max: number; tiers: number }

export function priceSummary(ticketTypes: { price: unknown }[] | undefined): EventPriceSummary | null {
  const prices = (ticketTypes ?? []).map((t) => Number(t.price)).filter((p) => Number.isFinite(p) && p >= 0)
  if (prices.length === 0) return null
  return { min: Math.min(...prices), max: Math.max(...prices), tiers: prices.length }
}

/** "Free", "₹299", "From ₹199" (several paid tiers) or "Free – ₹499" (a free tier and paid ones). */
export function priceLabel(price: EventPriceSummary | null | undefined, isPaid: boolean): string {
  if (!price) return isPaid ? "Paid" : "Free"
  const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`
  if (price.max <= 0) return "Free"
  if (price.min === price.max) return inr(price.min)
  return price.min <= 0 ? `Free – ${inr(price.max)}` : `From ${inr(price.min)}`
}

/** Dates as ISO strings, plus hasEnded (computed here, so a card never needs the clock) and the price summary. */
export function serializeEventCard<T extends { startDate: Date; endDate: Date; ticketTypes?: { price: unknown }[] }>(event: T, now: Date = new Date()) {
  const { ticketTypes, ...rest } = event
  return {
    ...rest,
    startDate: event.startDate.toISOString(),
    endDate: event.endDate.toISOString(),
    hasEnded: event.endDate.getTime() < now.getTime(),
    price: priceSummary(ticketTypes),
  }
}
