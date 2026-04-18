import crypto from "crypto"
import prisma from "@/lib/prisma"

const CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"

function getTicketSecret(): string {
  const secret = process.env.TICKET_SECRET
  if (!secret || secret.length < 32) {
    throw new Error("TICKET_SECRET env var must be set to a random string of at least 32 characters")
  }
  return secret
}

function generateTicketNumber(): string {
  let number = "TKT-"
  for (let i = 0; i < 8; i++) {
    number += CHARSET[crypto.randomInt(CHARSET.length)]
  }
  return number
}

function signQRPayload(ticketNumber: string, eventId: string, registrationNumber: string): string {
  const data = `${ticketNumber}:${eventId}:${registrationNumber}`
  return crypto.createHmac("sha256", getTicketSecret()).update(data).digest("hex")
}

export function createQRPayload(ticketNumber: string, eventId: string, registrationNumber: string): string {
  const signature = signQRPayload(ticketNumber, eventId, registrationNumber)
  return JSON.stringify({
    v: 1,
    t: ticketNumber,
    e: eventId,
    r: registrationNumber,
    s: signature,
  })
}

export function verifyQRSignature(ticketNumber: string, eventId: string, registrationNumber: string, signature: string): boolean {
  if (typeof signature !== "string") return false
  const expected = signQRPayload(ticketNumber, eventId, registrationNumber)
  const expectedBuf = Buffer.from(expected, "hex")
  let sigBuf: Buffer
  try {
    sigBuf = Buffer.from(signature, "hex")
  } catch {
    return false
  }
  if (expectedBuf.length !== sigBuf.length) return false
  return crypto.timingSafeEqual(expectedBuf, sigBuf)
}

export async function generateTicket(registrationId: string) {
  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: {
      event: { select: { id: true, endDate: true } },
      ticketType: { select: { id: true } },
      user: { select: { id: true } },
    },
  })

  if (!registration) throw new Error("Registration not found")

  // Generate unique ticket number
  let ticketNumber: string
  let attempts = 0
  do {
    ticketNumber = generateTicketNumber()
    const exists = await prisma.ticket.findUnique({ where: { ticketNumber } })
    if (!exists) break
    attempts++
  } while (attempts < 10)

  if (attempts >= 10) throw new Error("Failed to generate unique ticket number")

  const qrCode = createQRPayload(ticketNumber, registration.event.id, registration.registrationNumber)

  const validUntil = new Date(registration.event.endDate)
  validUntil.setHours(validUntil.getHours() + 2) // 2h grace period

  const ticket = await prisma.ticket.create({
    data: {
      ticketNumber,
      registrationId: registration.id,
      ticketTypeId: registration.ticketType.id,
      userId: registration.user.id,
      eventId: registration.event.id,
      status: "ACTIVE",
      qrCode,
      validFrom: new Date(),
      validUntil,
    },
  })

  return ticket
}

export async function validateTicketQR(qrDataString: string) {
  try {
    const payload = JSON.parse(qrDataString)

    if (payload.v !== 1) {
      return { valid: false, reason: "UNSUPPORTED_VERSION", message: "Unsupported ticket version" }
    }

    // Verify HMAC signature
    if (!verifyQRSignature(payload.t, payload.e, payload.r, payload.s)) {
      return { valid: false, reason: "INVALID_SIGNATURE", message: "Invalid ticket signature" }
    }

    // Find ticket
    const ticket = await prisma.ticket.findUnique({
      where: { ticketNumber: payload.t },
      include: {
        registration: { select: { registrationNumber: true, status: true } },
        event: { select: { id: true, title: true, startDate: true, endDate: true, venue: true, isOnline: true } },
        user: { select: { name: true, email: true, avatar: true } },
        ticketType: { select: { name: true, price: true } },
      },
    })

    if (!ticket) {
      return { valid: false, reason: "NOT_FOUND", message: "Ticket not found" }
    }

    if (ticket.status === "CANCELLED") {
      return { valid: false, reason: "CANCELLED", message: "This ticket has been cancelled" }
    }

    if (ticket.status === "USED") {
      return { valid: false, reason: "ALREADY_USED", message: "This ticket has already been used" }
    }

    if (ticket.status === "EXPIRED") {
      return { valid: false, reason: "EXPIRED", message: "This ticket has expired" }
    }

    if (ticket.status === "TRANSFERRED") {
      return { valid: false, reason: "TRANSFERRED", message: "This ticket has been transferred to another person" }
    }

    if (ticket.eventId !== payload.e) {
      return { valid: false, reason: "WRONG_EVENT", message: "Ticket is for a different event" }
    }

    const now = new Date()
    if (ticket.validUntil && now > ticket.validUntil) {
      return { valid: false, reason: "EXPIRED", message: "This ticket has expired" }
    }

    return {
      valid: true,
      ticket: {
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        status: ticket.status,
      },
      registration: {
        registrationNumber: ticket.registration.registrationNumber,
        status: ticket.registration.status,
      },
      event: {
        id: ticket.event.id,
        title: ticket.event.title,
        startDate: ticket.event.startDate,
        venue: ticket.event.venue,
      },
      participant: {
        name: ticket.user.name,
        email: ticket.user.email,
        avatar: ticket.user.avatar,
      },
      ticketType: {
        name: ticket.ticketType.name,
        price: Number(ticket.ticketType.price),
      },
    }
  } catch {
    return { valid: false, reason: "INVALID_FORMAT", message: "Invalid QR code data" }
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

export async function getUserTickets(userId: string, status?: string, timeframe?: string) {
  const now = new Date()

  const where: Record<string, unknown> = { userId }
  if (status && status !== "all") where.status = status.toUpperCase()
  if (timeframe === "upcoming") where.event = { startDate: { gte: now } }
  if (timeframe === "past") where.event = { endDate: { lt: now } }

  return prisma.ticket.findMany({
    where: where as any,
    include: {
      event: {
        select: {
          id: true, title: true, slug: true, startDate: true, endDate: true,
          venue: true, venueCity: true, isOnline: true, onlinePlatform: true,
          coverImage: true, organization: { select: { name: true } },
        },
      },
      ticketType: { select: { name: true, price: true, currency: true } },
      registration: { select: { registrationNumber: true, status: true } },
      checkIns: { select: { checkedInAt: true }, take: 1 },
    },
    orderBy: { event: { startDate: "asc" } },
  })
}
