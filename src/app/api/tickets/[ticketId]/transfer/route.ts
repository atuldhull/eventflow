import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { Prisma } from "@prisma/client"
import { z } from "zod/v4"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { createQRPayload, newTicketNumber } from "@/lib/registration-ticket"
import { createNotification } from "@/lib/notifications"
import { withoutTicketViewToken } from "@/lib/ticket-view-token"
import { createAuditLog, getClientInfo } from "@/lib/audit"

const transferSchema = z.object({
  recipientEmail: z.string().trim().toLowerCase().max(254).pipe(z.email()),
})

class TransferRefused extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

/**
 * Hands the caller's active ticket to someone else. A registration has exactly one ticket
 * (ticket.registrationId is unique), so both move to the recipient in place: the ticket
 * gets a new number and signed QR (the sender's copy stops scanning), its guest view link
 * is revoked, and the registration changes owner. Everything happens in one transaction;
 * a recipient account (for an email without one) is only created inside it.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  const senderId = session.user.id

  // The email is checked before anything is read or written
  const parsed = transferSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "Enter a valid recipient email" }, { status: 400 })
  }
  const { recipientEmail } = parsed.data
  const { ticketId } = await params

  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, userId: senderId },
    select: {
      id: true, status: true, eventId: true, registrationId: true, ticketNumber: true, metadata: true,
      registration: { select: { status: true, registrationNumber: true } },
      event: { select: { title: true, endDate: true, organizationId: true } },
      user: { select: { email: true, name: true } },
    },
  })

  if (!ticket) return NextResponse.json({ success: false, message: "Ticket not found" }, { status: 404 })
  if (ticket.status !== "ACTIVE") {
    return NextResponse.json({ success: false, message: `A ${ticket.status.toLowerCase()} ticket can't be transferred` }, { status: 400 })
  }
  if (ticket.registration.status !== "CONFIRMED") {
    return NextResponse.json({ success: false, message: "Only a confirmed registration's ticket can be transferred" }, { status: 400 })
  }
  if (ticket.event.endDate < new Date()) {
    return NextResponse.json({ success: false, message: "This event has ended" }, { status: 400 })
  }
  if (ticket.user.email.toLowerCase() === recipientEmail) {
    return NextResponse.json({ success: false, message: "Cannot transfer to yourself" }, { status: 400 })
  }

  let recipient: { id: string; name: string }
  try {
    recipient = await prisma.$transaction(async (tx) => {
      const user = await tx.user.upsert({
        where: { email: recipientEmail },
        update: {},
        create: { email: recipientEmail, name: recipientEmail.split("@")[0], role: "USER" },
        select: { id: true, name: true },
      })
      if (user.id === senderId) throw new TransferRefused("Cannot transfer to yourself", 400)

      const existing = await tx.registration.findUnique({
        where: { eventId_userId: { eventId: ticket.eventId, userId: user.id } },
        select: { id: true },
      })
      if (existing) throw new TransferRefused("Recipient is already registered for this event", 409)

      // Guarded on the state read above, so a double submit can't move it twice
      const ticketNumber = await newTicketNumber(tx)
      const { count } = await tx.ticket.updateMany({
        where: { id: ticket.id, userId: senderId, status: "ACTIVE" },
        data: {
          ticketNumber,
          qrCode: createQRPayload(ticketNumber, ticket.eventId, ticket.registration.registrationNumber),
          userId: user.id,
          transferredTo: user.id,
          transferredAt: new Date(),
          metadata: {
            ...withoutTicketViewToken(ticket.metadata),
            transferredFrom: { userId: senderId, ticketNumber: ticket.ticketNumber, at: new Date().toISOString() },
          },
        },
      })
      if (count === 0) throw new TransferRefused("This ticket was changed meanwhile. Refresh and try again.", 409)

      await tx.registration.update({ where: { id: ticket.registrationId }, data: { userId: user.id } })

      // Both people are told, with the transfer
      await createNotification({
        userId: senderId, type: "IN_APP", category: "REGISTRATION", title: "Ticket transferred",
        message: `Your ticket for ${ticket.event.title} was transferred to ${recipientEmail}. Your old QR code no longer works.`,
        eventId: ticket.eventId,
      }, tx)
      await createNotification({
        userId: user.id, type: "IN_APP", category: "REGISTRATION", title: "Ticket received",
        message: `${ticket.user.name || session.user.email} transferred their ticket for ${ticket.event.title} to you.`,
        data: { actionUrl: "/dashboard/tickets" },
        eventId: ticket.eventId,
        senderId,
      }, tx)
      return user
    })
  } catch (error) {
    if (error instanceof TransferRefused) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status })
    }
    // the recipient registered for the event at the same moment
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ success: false, message: "Recipient is already registered for this event" }, { status: 409 })
    }
    console.error("Ticket transfer failed:", error)
    return NextResponse.json({ success: false, message: "Transfer failed. Please try again." }, { status: 500 })
  }

  const { ipAddress, userAgent } = getClientInfo(request)
  await createAuditLog({
    userId: senderId,
    action: "UPDATE",
    entityType: "TICKET",
    entityId: ticket.id,
    description: `Transferred ticket ${ticket.ticketNumber} for ${ticket.event.title} to ${recipientEmail}`,
    newValues: { recipientId: recipient.id },
    eventId: ticket.eventId,
    organizationId: ticket.event.organizationId ?? undefined,
    ipAddress,
    userAgent,
  })

  return NextResponse.json({ success: true, message: `Ticket transferred to ${recipientEmail}`, data: { recipientId: recipient.id } })
}
