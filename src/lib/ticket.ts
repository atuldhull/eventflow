import prisma from "@/lib/prisma"
import { LEGACY_QR_PATTERN, issueTicket, verifyQRSignature } from "@/lib/registration-ticket"

export { createQRPayload, verifyQRSignature } from "@/lib/registration-ticket"

/** A ticket admits until this long after its event's (current) end. */
export const TICKET_GRACE_MS = 2 * 60 * 60 * 1000

/** Issues (or re-activates) the ticket of a paid registration; the same issuer as free ones. */
export async function generateTicket(registrationId: string) {
  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
    select: { id: true, eventId: true, ticketTypeId: true, userId: true },
  })
  if (!registration) throw new Error("Registration not found")

  return prisma.$transaction((tx) =>
    issueTicket(tx, {
      registrationId: registration.id,
      ticketTypeId: registration.ticketTypeId,
      userId: registration.userId,
      eventId: registration.eventId,
    })
  )
}

const TICKET_INCLUDE = {
  registration: { select: { id: true, registrationNumber: true, status: true } },
  event: { select: { id: true, title: true, startDate: true, endDate: true, venue: true, isOnline: true } },
  user: { select: { name: true, email: true, avatar: true } },
  ticketType: { select: { name: true, price: true } },
} as const

const invalid = (reason: string, message: string) => ({ valid: false as const, reason, message })

/**
 * Validates a scanned ticket QR. `eventId` is the event being scanned for.
 *
 * - The signed payload ({ v: 1, t, e, r, s }) must carry a valid HMAC, name the scanned
 *   event (when one is given) and match the ticket's event and registration.
 * - A legacy "EVF-…" value (free tickets issued before the signed format) has no
 *   signature: it is accepted only with `eventId`, by an exact match on the stored QR
 *   value of a ticket of that event, so it can't be used anywhere else.
 */
export async function validateTicketQR(qrDataString: string, opts: { eventId?: string } = {}) {
  try {
    const raw = typeof qrDataString === "string" ? qrDataString.trim() : ""
    let ticket

    if (LEGACY_QR_PATTERN.test(raw)) {
      if (!opts.eventId) return invalid("NOT_FOUND", "Ticket not found")
      ticket = await prisma.ticket.findFirst({ where: { qrCode: raw, eventId: opts.eventId }, include: TICKET_INCLUDE })
      if (!ticket) return invalid("NOT_FOUND", "Ticket not found for this event")
    } else {
      const payload = JSON.parse(raw)
      if (!payload || typeof payload !== "object") return invalid("INVALID_FORMAT", "Invalid QR code data")
      if (payload.v !== 1) return invalid("UNSUPPORTED_VERSION", "Unsupported ticket version")
      if (!verifyQRSignature(payload.t, payload.e, payload.r, payload.s)) {
        return invalid("INVALID_SIGNATURE", "Invalid ticket signature")
      }
      if (opts.eventId && payload.e !== opts.eventId) return invalid("WRONG_EVENT", "Ticket is for a different event")

      ticket = await prisma.ticket.findUnique({ where: { ticketNumber: payload.t }, include: TICKET_INCLUDE })
      if (!ticket) return invalid("NOT_FOUND", "Ticket not found")
      if (ticket.eventId !== payload.e) return invalid("WRONG_EVENT", "Ticket is for a different event")
      if (ticket.registration.registrationNumber !== payload.r) return invalid("INVALID_SIGNATURE", "Invalid ticket signature")
    }

    if (ticket.status === "CANCELLED") return invalid("CANCELLED", "This ticket has been cancelled")
    if (ticket.status === "USED") return invalid("ALREADY_USED", "This ticket has already been used")
    if (ticket.status === "EXPIRED") return invalid("EXPIRED", "This ticket has expired")
    if (ticket.status === "TRANSFERRED") return invalid("TRANSFERRED", "This ticket has been transferred to another person")

    if (Date.now() > ticket.event.endDate.getTime() + TICKET_GRACE_MS) {
      return invalid("EXPIRED", "This ticket has expired")
    }

    return {
      valid: true as const,
      ticket: { id: ticket.id, ticketNumber: ticket.ticketNumber, status: ticket.status, registrationId: ticket.registration.id },
      registration: { registrationNumber: ticket.registration.registrationNumber, status: ticket.registration.status },
      event: { id: ticket.event.id, title: ticket.event.title, startDate: ticket.event.startDate, venue: ticket.event.venue },
      participant: { name: ticket.user.name, email: ticket.user.email, avatar: ticket.user.avatar },
      ticketType: { name: ticket.ticketType.name, price: Number(ticket.ticketType.price) },
    }
  } catch {
    return invalid("INVALID_FORMAT", "Invalid QR code data")
  }
}

export async function cancelTicket(ticketId: string) {
  return prisma.ticket.update({
    where: { id: ticketId },
    data: { status: "CANCELLED" },
  })
}

export async function markTicketUsed(ticketId: string) {
  return prisma.ticket.update({
    where: { id: ticketId },
    data: { status: "USED" },
  })
}

export const TICKET_TIMEFRAMES = ["upcoming", "past", "all"] as const
export const TICKET_STATUSES = ["ACTIVE", "USED", "CANCELLED", "EXPIRED", "TRANSFERRED"] as const

/**
 * The user's tickets. "upcoming" is every event that hasn't ended yet, so a ticket stays
 * listed (as happening now) while its event runs; "past" is ended events; anything else
 * is all of them.
 */
export async function getUserTickets(
  userId: string,
  status?: (typeof TICKET_STATUSES)[number],
  timeframe?: (typeof TICKET_TIMEFRAMES)[number]
) {
  const now = new Date()

  return prisma.ticket.findMany({
    where: {
      userId,
      ...(status ? { status } : {}),
      ...(timeframe === "upcoming" ? { event: { endDate: { gte: now } } } : {}),
      ...(timeframe === "past" ? { event: { endDate: { lt: now } } } : {}),
    },
    include: {
      event: {
        select: {
          id: true, title: true, slug: true, startDate: true, endDate: true,
          venue: true, venueCity: true, isOnline: true, onlinePlatform: true, type: true,
          coverImage: true, organization: { select: { name: true } },
        },
      },
      ticketType: { select: { name: true, price: true, currency: true } },
      // id is what /api/registrations/[registrationId]/cancel takes; ticket ids are not registration ids
      registration: { select: { id: true, registrationNumber: true, status: true } },
      checkIns: { select: { checkedInAt: true }, take: 1 },
    },
    orderBy: { event: { startDate: "asc" } },
  })
}
