/**
 * Where a ticket admits its holder. An in-person event shows its venue; an online one
 * "Online". A hybrid event (type HYBRID, or online with a venue set) depends on the ticket:
 * an online ticket ("Online", "Virtual", "Livestream"...) is "Online", an in-person one
 * ("In person", "Venue"...) the venue, and an unnamed one both.
 */
export interface TicketPlaceEvent {
  isOnline: boolean
  type?: string | null
  venue?: string | null
  venueCity?: string | null
}

export type TicketPlace = { kind: "venue" | "online" | "both"; label: string }

const ONLINE_TICKET = /\b(online|virtual|remote|live ?stream(ing)?|stream(ing)?|webinar|digital)\b/i
const IN_PERSON_TICKET = /\b(in[- ]?person|venue|on[- ]?site|offline|physical|walk[- ]?in)\b/i

export function ticketPlace(event: TicketPlaceEvent, ticketTypeName?: string | null): TicketPlace {
  const venue = [event.venue, event.venueCity].filter((v): v is string => !!v && !!v.trim()).join(", ")
  const venueLabel = venue || "Venue to be announced"
  const hybrid = event.type === "HYBRID" || (event.isOnline && !!venue)

  if (!hybrid) return event.isOnline ? { kind: "online", label: "Online" } : { kind: "venue", label: venueLabel }

  const name = ticketTypeName ?? ""
  if (IN_PERSON_TICKET.test(name)) return { kind: "venue", label: venueLabel }
  if (ONLINE_TICKET.test(name)) return { kind: "online", label: "Online" }
  return { kind: "both", label: `${venueLabel} or online` }
}
