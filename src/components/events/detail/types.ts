import type { Tone } from "@/components/ui/pill"
import { formatInZone } from "@/lib/event-time"

export interface EventData {
  id: string; title: string; slug: string; description: string; shortDescription: string
  status: string; type: string; visibility: string; category: string; tags: string[]
  startDate: string; endDate: string; timezone: string
  registrationStartDate: string | null; registrationEndDate: string | null
  venue: string | null; venueAddress: string | null; venueCity: string | null
  venueState: string | null; venueCountry: string | null
  venueLatitude?: number | null; venueLongitude?: number | null
  isOnline: boolean; onlinePlatform: string | null
  coverImage: string | null; gallery: string[]
  maxCapacity: number | null; currentRegistrations: number
  waitlistEnabled: boolean; approvalRequired: boolean
  allowTeamRegistration: boolean; minTeamSize: number | null; maxTeamSize: number | null
  isPaid: boolean; rules: string | null; termsAndConditions: string | null
  refundPolicy: string | null; contactEmail: string | null; contactPhone: string | null
  isFeatured: boolean
  organization: { id: string; name: string; logo: string | null; description: string | null; slug: string }
  myRegistration: { id: string; status: string; registrationNumber: string } | null
  ticketTypes: { id: string; name: string; description: string | null; price: number; currency: string; quantity: number | null; sold: number; maxPerUser: number }[]
  sessions: { id: string; title: string; description: string | null; speaker: string | null; speakerBio: string | null; startTime: string; endTime: string; venue: string | null; track: string | null }[]
  sponsors: { id: string; name: string; logo: string | null; website: string | null; tier: string }[]
  faqs: { id: string; question: string; answer: string }[]
}

/**
 * Public-facing event status: the attendee's word for each state and its pill
 * tone. Presentation only; status values are unchanged.
 */
export const EVENT_STATUS: Record<string, { label: string; tone: Tone; live?: boolean }> = {
  PUBLISHED: { label: "Upcoming", tone: "info" },
  REGISTRATION_OPEN: { label: "Registration open", tone: "positive" },
  REGISTRATION_CLOSED: { label: "Registration closed", tone: "info" },
  ONGOING: { label: "Happening now", tone: "positive", live: true },
  COMPLETED: { label: "Completed", tone: "neutral" },
  CANCELLED: { label: "Cancelled", tone: "negative" },
}

export const eventStatus = (status: string) => EVENT_STATUS[status] ?? EVENT_STATUS.PUBLISHED

export const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`

// Event times are shown on the event's own clock (EventData.timezone); pass it as `tz`.
export const fmtDate = (d: string, tz?: string | null) => formatInZone(d, tz, { weekday: "long", day: "numeric", month: "long", year: "numeric" })
export const fmtDay = (d: string, tz?: string | null) => formatInZone(d, tz, { weekday: "short", day: "numeric", month: "short", year: "numeric" })
export const fmtTime = (d: string, tz?: string | null) => formatInZone(d, tz, { hour: "2-digit", minute: "2-digit" })
export const fmtShort = (d: string, tz?: string | null) => formatInZone(d, tz, { day: "numeric", month: "short" })
