import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { EVENT_NOT_FOUND, apiKeyEventWhere, findApiKeyEvent, withApiAuth } from "@/lib/api-auth"
import prisma from "@/lib/prisma"
import { createQRPayload } from "@/lib/ticket"
import { Prisma } from "@prisma/client"
import {
  CAPACITY_ERRORS,
  EXISTING_REGISTRATION_SELECT,
  FRESH_REGISTRATION_FIELDS,
  ReuseConflict,
  capacityErrorCode,
  claimRegistrationCapacity,
  resetPaymentForReuse,
  reuseBlocker,
  takeOverRegistration,
} from "@/lib/registration-capacity"
import { releaseExpiredHolds } from "@/lib/seat-hold"
import { liveWorkspaceWhere } from "@/lib/public-events"
import crypto from "crypto"

const randomSuffix = () => crypto.randomUUID().slice(0, 4).toUpperCase()

export const GET = withApiAuth("registrations:read", async (req, ctx, routeCtx) => {
  const { eventId } = await routeCtx.params
  const searchParams = req.nextUrl.searchParams
  const page = parseInt(searchParams.get("page") || "1")
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100)
  const status = searchParams.get("status") || ""

  // Only the key's own events (its organization's, or its enterprise's).
  if (!(await findApiKeyEvent(ctx, eventId))) return NextResponse.json(EVENT_NOT_FOUND, { status: 404 })

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

  // Verify event exists, is the key's own (its organization's, or its enterprise's) and is
  // open; an event of a deactivated or deleted organization or enterprise is "not found",
  // as on the public site.
  const event = await prisma.event.findFirst({
    where: { id: String(eventId), deletedAt: null, AND: [apiKeyEventWhere(ctx), liveWorkspaceWhere()] },
    select: { id: true, status: true, maxCapacity: true, currentRegistrations: true, isPaid: true, approvalRequired: true, title: true },
  })
  if (!event) return NextResponse.json(EVENT_NOT_FOUND, { status: 404 })
  if (!["PUBLISHED", "REGISTRATION_OPEN"].includes(event.status)) {
    return NextResponse.json({ error: { code: "bad_request", message: "Registration is not open" } }, { status: 400 })
  }

  // Every registration needs a ticket type; default to the event's first active one.
  const ticketType = await prisma.ticketType.findFirst({
    where: { eventId, isActive: true, ...(ticketTypeId ? { id: String(ticketTypeId) } : {}) },
    orderBy: { sortOrder: "asc" },
    select: { id: true },
  })
  if (!ticketType) {
    return NextResponse.json({ error: { code: "bad_request", message: ticketTypeId ? "Invalid ticket type" : "Event has no active ticket types" } }, { status: 400 })
  }

  // Find or note the user
  let user = await prisma.user.findUnique({ where: { email: participantEmail }, select: { id: true } })
  if (!user) {
    // Create a minimal user for API registrations
    user = await prisma.user.create({ data: { email: participantEmail, name: participantName, role: "USER" } })
  }

  try {
    await releaseExpiredHolds({ eventId })
  } catch (error) {
    console.error("Releasing expired seat holds failed:", error)
  }

  // Check duplicate. As in POST /api/registrations, a cancelled, rejected or released
  // registration is reused for the new attempt instead of blocking it.
  const existing = await prisma.registration.findUnique({
    where: { eventId_userId: { eventId, userId: user.id } },
    select: EXISTING_REGISTRATION_SELECT,
  })
  const blocker = existing ? reuseBlocker(existing) : null
  if (blocker === "ALREADY_REGISTERED") return NextResponse.json({ error: { code: "conflict", message: "Already registered" } }, { status: 409 })
  if (blocker === "PAYMENT_HELD") {
    return NextResponse.json({ error: { code: "conflict", message: "An earlier registration has a payment that hasn't been refunded yet" } }, { status: 409 })
  }

  // Paid-event registrations made through the API have no checkout, so they stay PENDING
  // and (like approval-required ones) only count against capacity once confirmed.
  const awaitsConfirmation = event.approvalRequired || event.isPaid

  // Random suffix: concurrent API calls in the same millisecond must not collide.
  const regNumber = existing?.registrationNumber ?? `EVT-${Date.now().toString(36).toUpperCase()}${randomSuffix()}`
  const userId = user.id
  let created
  try {
    // Same conditional claims as POST /api/registrations: event seat (or waitlist) and
    // ticket stock are taken with UPDATE ... WHERE <still room> inside the transaction.
    created = await prisma.$transaction(async (tx) => {
      if (existing) await takeOverRegistration(tx, existing)
      const { waitlisted, waitlistPosition } = await claimRegistrationCapacity(tx, {
        eventId,
        ticketTypeId: ticketType.id,
        quantity: 1,
        countsNow: !awaitsConfirmation,
      })
      const status: "WAITLISTED" | "PENDING" | "CONFIRMED" = waitlisted ? "WAITLISTED" : awaitsConfirmation ? "PENDING" : "CONFIRMED"

      const fields = {
        status,
        ticketTypeId: ticketType.id,
        formResponses: formResponses || undefined,
        waitlistPosition,
        metadata: { ticketQuantity: 1, ...(existing ? { reregisteredAt: new Date().toISOString(), previousStatus: existing.status } : {}) },
        source: "API",
      }
      const registration = existing
        ? await tx.registration.update({ where: { id: existing.id }, data: { ...fields, ...FRESH_REGISTRATION_FIELDS } })
        : await tx.registration.create({ data: { ...fields, eventId, userId, registrationNumber: regNumber } })
      // API registrations are never charged; close an unpaid payment left by an earlier attempt.
      if (existing?.payment) await resetPaymentForReuse(tx, existing.payment, null)

      // Generate ticket for free confirmed registrations (re-activating one cancelled with
      // an earlier attempt: a registration has at most one ticket).
      let ticket = null
      const oldTicket = existing ? await tx.ticket.findUnique({ where: { registrationId: registration.id } }) : null
      if (status === "CONFIRMED" && !event.isPaid && oldTicket) {
        ticket = await tx.ticket.update({ where: { id: oldTicket.id }, data: { status: "ACTIVE", ticketTypeId: ticketType.id, userId } })
      } else if (status === "CONFIRMED" && !event.isPaid) {
        const ticketNum = `TKT-${Date.now().toString(36).toUpperCase()}${randomSuffix()}`
        const qrData = createQRPayload(ticketNum, eventId, regNumber)
        ticket = await tx.ticket.create({
          data: { registrationId: registration.id, userId, eventId, ticketTypeId: ticketType.id, ticketNumber: ticketNum, qrCode: qrData, status: "ACTIVE" },
        })
      }
      return { registration, ticket, status }
    })
  } catch (error) {
    if (error instanceof ReuseConflict) {
      return NextResponse.json({ error: { code: "conflict", message: "Already registered" } }, { status: 409 })
    }
    const code = capacityErrorCode(error)
    if (code) {
      return NextResponse.json({ error: { code: code === "EVENT_GONE" ? "not_found" : "bad_request", message: CAPACITY_ERRORS[code].message } }, { status: CAPACITY_ERRORS[code].status })
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && String(error.meta?.target ?? "").includes("user")) {
      return NextResponse.json({ error: { code: "conflict", message: "Already registered" } }, { status: 409 })
    }
    throw error
  }
  const { registration, ticket, status } = created

  return NextResponse.json({
    data: {
      id: registration.id, registrationNumber: regNumber, status,
      participant: { name: participantName, email: participantEmail },
      ticket: ticket ? { ticketNumber: ticket.ticketNumber, qrCode: ticket.qrCode } : null,
    },
  }, { status: 201 })
})
