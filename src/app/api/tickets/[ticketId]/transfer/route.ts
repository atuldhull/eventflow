import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })

  const { ticketId } = await params
  const { recipientEmail } = await request.json()

  if (!recipientEmail) return NextResponse.json({ success: false, message: "Recipient email required" }, { status: 400 })

  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, userId: session.user.id },
    select: { id: true, status: true, eventId: true, registrationId: true, ticketNumber: true, ticketTypeId: true },
  })

  if (!ticket) return NextResponse.json({ success: false, message: "Ticket not found" }, { status: 404 })
  if (ticket.status !== "ACTIVE") return NextResponse.json({ success: false, message: `Cannot transfer a ${ticket.status} ticket` }, { status: 400 })

  // Find or create recipient
  let recipient = await prisma.user.findUnique({ where: { email: recipientEmail }, select: { id: true, email: true, name: true } })
  if (!recipient) {
    recipient = await prisma.user.create({ data: { email: recipientEmail, name: recipientEmail.split("@")[0], role: "USER" } })
  }

  if (recipient.id === session.user.id) return NextResponse.json({ success: false, message: "Cannot transfer to yourself" }, { status: 400 })

  // Check if recipient already registered for this event
  const existingReg = await prisma.registration.findUnique({ where: { eventId_userId: { eventId: ticket.eventId, userId: recipient.id } } })
  if (existingReg) return NextResponse.json({ success: false, message: "Recipient is already registered for this event" }, { status: 409 })

  // Transfer ticket + registration
  await prisma.$transaction([
    prisma.ticket.update({
      where: { id: ticketId },
      data: { userId: recipient.id, status: "TRANSFERRED", transferredTo: recipient.id, transferredAt: new Date() },
    }),
    // Create new active ticket for recipient
    prisma.ticket.create({
      data: {
        registrationId: ticket.registrationId, userId: recipient.id, eventId: ticket.eventId,
        ticketTypeId: ticket.ticketTypeId,
        ticketNumber: `TKT-${Date.now().toString(36).toUpperCase()}`,
        qrCode: `transfer:${ticket.ticketNumber}:${recipient.id}`,
        status: "ACTIVE",
      },
    }),
    // Update registration ownership
    prisma.registration.update({
      where: { id: ticket.registrationId },
      data: { userId: recipient.id },
    }),
  ])

  // Notify both users
  await prisma.notification.createMany({
    data: [
      { userId: session.user.id, type: "REGISTRATION" as any, category: "REGISTRATION" as any, title: "Ticket Transferred", message: `Your ticket ${ticket.ticketNumber} has been transferred to ${recipientEmail}` },
      { userId: recipient.id, type: "REGISTRATION" as any, category: "REGISTRATION" as any, title: "Ticket Received", message: `You received a ticket transfer from ${session.user.email}. Check your dashboard for details.` },
    ],
  })

  return NextResponse.json({ success: true, message: `Ticket transferred to ${recipientEmail}` })
}
