export interface EventData {
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
  myRegistration: { id: string; status: string; registrationNumber: string } | null
  ticketTypes: { id: string; name: string; description: string | null; price: number; currency: string; quantity: number | null; sold: number; maxPerUser: number }[]
  sessions: { id: string; title: string; description: string | null; speaker: string | null; speakerBio: string | null; startTime: string; endTime: string; venue: string | null; track: string | null }[]
  sponsors: { id: string; name: string; logo: string | null; website: string | null; tier: string }[]
  faqs: { id: string; question: string; answer: string }[]
}

export const statusConfig: Record<string, { label: string; color: string; dot: string }> = {
  PUBLISHED: { label: "Upcoming", color: "bg-blue-100 text-blue-700", dot: "bg-blue-500" },
  REGISTRATION_OPEN: { label: "Registration Open", color: "bg-green-100 text-green-700", dot: "bg-green-500" },
  REGISTRATION_CLOSED: { label: "Registration Closed", color: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
  ONGOING: { label: "Happening Now", color: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500 animate-pulse" },
  COMPLETED: { label: "Completed", color: "bg-zinc-100 text-zinc-700", dot: "bg-zinc-500" },
}

export const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
export const fmtTime = (d: string) => new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
export const fmtShort = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
