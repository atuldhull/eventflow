import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { EVENT_NOT_FOUND, apiKeyEventWhere, withApiAuth } from "@/lib/api-auth"
import prisma from "@/lib/prisma"

export const GET = withApiAuth("events:read", async (req, ctx, routeCtx) => {
  const { eventId } = await routeCtx.params

  const event = await prisma.event.findFirst({
    where: {
      id: String(eventId),
      deletedAt: null,
      // only the key's own events (its organization's, or its enterprise's)
      AND: [apiKeyEventWhere(ctx)],
    },
    include: {
      ticketTypes: { where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true, description: true, price: true, currency: true, quantity: true, sold: true, maxPerUser: true } },
      sessions: { orderBy: { startTime: "asc" }, select: { id: true, title: true, speaker: true, startTime: true, endTime: true, venue: true, track: true } },
      organization: { select: { id: true, name: true } },
    },
  })

  if (!event) {
    return NextResponse.json(EVENT_NOT_FOUND, { status: 404 })
  }

  return NextResponse.json({ data: event })
})
