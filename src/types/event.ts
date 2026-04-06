import type { EventStatus, TicketType } from "@/lib/constants"

export interface Event {
  id: string
  title: string
  slug: string
  description: string
  startDate: Date
  endDate: Date
  location?: string
  isVirtual: boolean
  maxAttendees?: number
  status: EventStatus
  ticketType: TicketType
  organizerId: string
  organizationId: string
  createdAt: Date
  updatedAt: Date
}

export interface EventWithOrganizer extends Event {
  organizer: {
    id: string
    name: string
    image?: string
  }
}
