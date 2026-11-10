import { NextResponse } from "next/server"
import { apiKeyEventWhere, withApiAuth } from "@/lib/api-auth"
import prisma from "@/lib/prisma"

export const GET = withApiAuth("checkins:read", async (req, ctx, routeCtx) => {
  const { ticketNumber } = await routeCtx.params

  const ticket = await prisma.ticket.findFirst({
    // only tickets of the key's own events (its organization's, or its enterprise's)
    where: { ticketNumber: String(ticketNumber), event: { AND: [apiKeyEventWhere(ctx)] } },
    select: {
      id: true, ticketNumber: true, status: true,
      user: { select: { name: true, email: true } },
      event: { select: { id: true, title: true, startDate: true, endDate: true, venue: true } },
      ticketType: { select: { name: true, price: true } },
      registration: { select: { status: true, registrationNumber: true } },
    },
  })

  if (!ticket) return NextResponse.json({ error: { code: "not_found", message: "Ticket not found" } }, { status: 404 })

  const checkedIn = ticket.registration?.status === "CHECKED_IN"

  return NextResponse.json({
    data: {
      valid: ticket.status === "ACTIVE",
      ticketNumber: ticket.ticketNumber,
      status: ticket.status,
      participant: { name: ticket.user.name, email: ticket.user.email },
      event: { id: ticket.event.id, title: ticket.event.title, startDate: ticket.event.startDate.toISOString(), venue: ticket.event.venue },
      ticketType: ticket.ticketType ? { name: ticket.ticketType.name, price: Number(ticket.ticketType.price) } : null,
      checkedIn,
      registrationNumber: ticket.registration?.registrationNumber || null,
    },
  })
})
