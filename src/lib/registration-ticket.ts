import crypto from "crypto"
import type { Prisma } from "@prisma/client"
import { notify } from "@/lib/notifications"
import { withoutTicketViewToken } from "@/lib/ticket-view-token"

type Tx = Prisma.TransactionClient

const CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"

function getTicketSecret(): string {
  const secret = process.env.TICKET_SECRET
  if (!secret || secret.length < 32) {
    throw new Error("TICKET_SECRET env var must be set to a random string of at least 32 characters")
  }
  return secret
}

/** "TKT-" and 8 characters without look-alikes (no 0/O, 1/I/L): the number printed under the QR. */
export function generateTicketNumber(): string {
  let number = "TKT-"
  for (let i = 0; i < 8; i++) number += CHARSET[crypto.randomInt(CHARSET.length)]
  return number
}

function signQRPayload(ticketNumber: string, eventId: string, registrationNumber: string): string {
  const data = `${ticketNumber}:${eventId}:${registrationNumber}`
  return crypto.createHmac("sha256", getTicketSecret()).update(data).digest("hex")
}

/** The QR value of every ticket: ticket, event and registration, signed with TICKET_SECRET. */
export function createQRPayload(ticketNumber: string, eventId: string, registrationNumber: string): string {
  const signature = signQRPayload(ticketNumber, eventId, registrationNumber)
  return JSON.stringify({ v: 1, t: ticketNumber, e: eventId, r: registrationNumber, s: signature })
}

export function verifyQRSignature(ticketNumber: unknown, eventId: unknown, registrationNumber: unknown, signature: unknown): boolean {
  if (typeof ticketNumber !== "string" || typeof eventId !== "string" || typeof registrationNumber !== "string") return false
  if (typeof signature !== "string" || !/^[0-9a-f]{64}$/i.test(signature)) return false
  const expected = Buffer.from(signQRPayload(ticketNumber, eventId, registrationNumber), "hex")
  const given = Buffer.from(signature, "hex")
  return expected.length === given.length && crypto.timingSafeEqual(expected, given)
}

/**
 * The unsigned "EVF-xxxxxxxx-xxx" value free tickets used to get. Tickets issued with it
 * keep it (it may be printed or saved), and the validator accepts it only by an exact
 * lookup inside the event being scanned.
 */
export const LEGACY_QR_PATTERN = /^EVF-[0-9a-f]{8}-[0-9a-f]{3}$/

/** A ticket number no other ticket has (checked inside the caller's transaction). */
export async function newTicketNumber(tx: Tx): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const ticketNumber = generateTicketNumber()
    if (!(await tx.ticket.findUnique({ where: { ticketNumber }, select: { id: true } }))) return ticketNumber
  }
  throw new Error("Failed to generate a unique ticket number")
}

/**
 * The one way a registration gets its ticket: free registration (POST /api/registrations),
 * "Add participant", organizer approval and paid completion all come here, so every ticket
 * carries the same signed QR payload that check-in validates. A registration has at most
 * one ticket: an existing live one is returned as is; one cancelled with an earlier attempt
 * is re-activated with a fresh number and QR, so a copy kept from before stays void.
 * Issuing (not returning an existing ticket) is the confirmation, so the attendee's
 * "Registration confirmed" notification is written here, in the same transaction, once.
 */
export async function issueTicket(
  tx: Tx,
  reg: { registrationId: string; ticketTypeId: string; userId: string; eventId: string }
) {
  const existing = await tx.ticket.findUnique({ where: { registrationId: reg.registrationId } })
  if (existing && existing.status !== "CANCELLED") return existing

  const registration = await tx.registration.findUnique({
    where: { id: reg.registrationId },
    select: { registrationNumber: true, event: { select: { title: true } } },
  })
  if (!registration) throw new Error("Registration not found")

  const ticketNumber = await newTicketNumber(tx)
  const fields = {
    ticketNumber,
    qrCode: createQRPayload(ticketNumber, reg.eventId, registration.registrationNumber),
    status: "ACTIVE" as const,
    ticketTypeId: reg.ticketTypeId,
    userId: reg.userId,
    validFrom: new Date(),
    // expiry follows the event's current end date (see validateTicketQR), not a stored copy
    validUntil: null,
  }
  const ticket = existing
    ? // a guest view link handed out for the cancelled ticket stays revoked
      await tx.ticket.update({ where: { id: existing.id }, data: { ...fields, metadata: withoutTicketViewToken(existing.metadata) } })
    : await tx.ticket.create({ data: { ...fields, registrationId: reg.registrationId, eventId: reg.eventId } })

  await notify.registrationConfirmed(
    { userId: reg.userId, eventId: reg.eventId, registrationNumber: registration.registrationNumber },
    registration.event.title,
    tx
  )
  return ticket
}

/** Kept for the existing callers (registration, manual add, approval). */
export const issueFreeTicket = issueTicket
