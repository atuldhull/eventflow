import { NextResponse } from "next/server"
import { EVENT_NOT_FOUND, findApiKeyEvent, withApiAuth } from "@/lib/api-auth"
import prisma from "@/lib/prisma"

export const GET = withApiAuth("checkins:read", async (req, ctx, routeCtx) => {
  const { eventId } = await routeCtx.params
  const sp = req.nextUrl.searchParams
  const page = parseInt(sp.get("page") || "1")
  const limit = Math.min(parseInt(sp.get("limit") || "20"), 100)

  // Only the key's own events (its organization's, or its enterprise's).
  if (!(await findApiKeyEvent(ctx, eventId))) return NextResponse.json(EVENT_NOT_FOUND, { status: 404 })

  const where: any = { eventId }

  const [checkIns, total] = await Promise.all([
    prisma.checkIn.findMany({
      where, orderBy: { checkedInAt: "desc" }, skip: (page - 1) * limit, take: limit,
      select: { id: true, checkedInAt: true, checkInMethod: true, registration: { select: { registrationNumber: true, user: { select: { name: true, email: true } }, ticketType: { select: { name: true } } } } },
    }),
    prisma.checkIn.count({ where }),
  ])

  return NextResponse.json({
    data: checkIns.map(c => ({
      id: c.id, checkedInAt: c.checkedInAt.toISOString(), method: c.checkInMethod,
      participant: { name: c.registration.user.name, email: c.registration.user.email },
      registrationNumber: c.registration.registrationNumber,
      ticketType: c.registration.ticketType?.name || "General",
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasMore: page * limit < total },
  })
})

export const POST = withApiAuth("checkins:write", async (req, ctx, routeCtx) => {
  const { eventId } = await routeCtx.params
  // Only the key's own events (its organization's, or its enterprise's).
  if (!(await findApiKeyEvent(ctx, eventId))) return NextResponse.json(EVENT_NOT_FOUND, { status: 404 })
  const { registrationId, ticketNumber } = await req.json()

  if (!registrationId && !ticketNumber) {
    return NextResponse.json({ error: { code: "bad_request", message: "registrationId or ticketNumber required" } }, { status: 400 })
  }

  const where: any = registrationId
    ? { id: registrationId, eventId }
    : { tickets: { some: { ticketNumber } }, eventId }

  const registration = await prisma.registration.findFirst({
    where, select: { id: true, status: true, userId: true, event: { select: { organizationId: true } } },
  })

  if (!registration) return NextResponse.json({ error: { code: "not_found", message: "Registration not found" } }, { status: 404 })
  if (registration.status === "CHECKED_IN") return NextResponse.json({ error: { code: "conflict", message: "Already checked in" } }, { status: 409 })
  if (registration.status !== "CONFIRMED") return NextResponse.json({ error: { code: "bad_request", message: `Cannot check in registration with status: ${registration.status}` } }, { status: 400 })

  // Get ticket for this registration
  const ticket = await prisma.ticket.findFirst({ where: { registrationId: registration.id }, select: { id: true } })

  const checkIn = await prisma.checkIn.create({
    data: { eventId, registrationId: registration.id, userId: registration.userId, checkedInBy: ctx.userId, checkInMethod: "API", ticketId: ticket?.id || "" },
  })

  await prisma.registration.update({ where: { id: registration.id }, data: { status: "CHECKED_IN" } })

  return NextResponse.json({ data: { id: checkIn.id, checkedInAt: checkIn.checkedInAt.toISOString(), method: "API" } }, { status: 201 })
})
