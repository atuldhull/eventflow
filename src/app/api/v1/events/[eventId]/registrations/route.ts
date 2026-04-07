import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { withApiAuth } from "@/lib/api-auth"
import prisma from "@/lib/prisma"
import { createQRPayload } from "@/lib/ticket"

export const GET = withApiAuth("registrations:read", async (req, ctx, routeCtx) => {
  const { eventId } = await routeCtx.params
  const searchParams = req.nextUrl.searchParams
  const page = parseInt(searchParams.get("page") || "1")
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100)
  const status = searchParams.get("status") || ""

  const where: Record<string, unknown> = { eventId }
  if (status) where.status = status

  const [registrations, total] = await Promise.all([
    prisma.registration.findMany({
      where: where as any,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true, registrationNumber: true, status: true, type: true, createdAt: true,
        user: { select: { name: true, email: true, phone: true } },
        ticketType: { select: { name: true, price: true } },
        checkIn: { select: { checkedInAt: true } },
      },
    }),
    prisma.registration.count({ where: where as any }),
  ])

  return NextResponse.json({
    data: registrations.map((r) => ({
      id: r.id, registrationNumber: r.registrationNumber, status: r.status, type: r.type,
      participant: { name: r.user.name, email: r.user.email, phone: r.user.phone },
      ticketType: { name: r.ticketType.name, price: Number(r.ticketType.price) },
      checkedIn: !!r.checkIn, checkedInAt: r.checkIn?.checkedInAt?.toISOString() || null,
      createdAt: r.createdAt.toISOString(),
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasMore: page * limit < total },
  })
})

export const POST = withApiAuth("registrations:write", async (req, ctx, routeCtx) => {
  const { eventId } = await routeCtx.params
  const body = await req.json()
  const { participantEmail, participantName, ticketTypeId, formResponses } = body

  if (!participantEmail || !participantName) {
    return NextResponse.json({ error: { code: "bad_request", message: "participantEmail and participantName are required" } }, { status: 400 })
  }

  // Verify event exists and is open
  const event = await prisma.event.findFirst({
    where: { id: eventId, organizationId: ctx.organizationId || undefined, deletedAt: null },
    select: { id: true, status: true, maxCapacity: true, currentRegistrations: true, isPaid: true, approvalRequired: true, title: true },
  })
  if (!event) return NextResponse.json({ error: { code: "not_found", message: "Event not found" } }, { status: 404 })
  if (!["PUBLISHED", "REGISTRATION_OPEN"].includes(event.status)) {
    return NextResponse.json({ error: { code: "bad_request", message: "Registration is not open" } }, { status: 400 })
  }
  if (event.maxCapacity && event.currentRegistrations >= event.maxCapacity) {
    return NextResponse.json({ error: { code: "bad_request", message: "Event is full" } }, { status: 400 })
  }

  // Find or note the user
  let user = await prisma.user.findUnique({ where: { email: participantEmail }, select: { id: true } })
  if (!user) {
    // Create a minimal user for API registrations
    user = await prisma.user.create({ data: { email: participantEmail, name: participantName, role: "USER" } })
  }

  // Check duplicate
  const existing = await prisma.registration.findUnique({ where: { eventId_userId: { eventId, userId: user.id } } })
  if (existing) return NextResponse.json({ error: { code: "conflict", message: "Already registered" } }, { status: 409 })

  const regNumber = `EVT-${Date.now().toString(36).toUpperCase()}`
  const status = event.approvalRequired ? "PENDING" : (event.isPaid ? "PENDING" : "CONFIRMED")

  const registration = await prisma.registration.create({
    data: {
      eventId, userId: user.id, status: status as any, registrationNumber: regNumber,
      ticketTypeId: ticketTypeId || undefined,
      formResponses: formResponses || undefined,
      source: "API",
    },
  })

  // Update count if confirmed
  if (status === "CONFIRMED") {
    await prisma.event.update({ where: { id: eventId }, data: { currentRegistrations: { increment: 1 } } })
  }

  // Generate ticket for free confirmed registrations
  let ticket = null
  if (status === "CONFIRMED" && !event.isPaid) {
    const ticketNum = `TKT-${Date.now().toString(36).toUpperCase()}`
    const qrData = createQRPayload(ticketNum, eventId, regNumber)
    ticket = await prisma.ticket.create({
      data: { registrationId: registration.id, userId: user.id, eventId, ticketTypeId: ticketTypeId || undefined, ticketNumber: ticketNum, qrCode: qrData, status: "ACTIVE" },
    })
  }

  return NextResponse.json({
    data: {
      id: registration.id, registrationNumber: regNumber, status,
      participant: { name: participantName, email: participantEmail },
      ticket: ticket ? { ticketNumber: ticket.ticketNumber, qrCode: ticket.qrCode } : null,
    },
  }, { status: 201 })
})
