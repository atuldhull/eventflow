import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { Prisma } from "@prisma/client"
import { z } from "zod/v4"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { validateTicketQR } from "@/lib/ticket"
import { createAuditLog, getClientInfo } from "@/lib/audit"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"

const checkInSchema = z.object({
  method: z.enum(["QR_SCAN", "MANUAL"]),
  eventId: z.string().trim().min(1).max(64),
  qrData: z.string().max(4000).optional(),
  registrationId: z.string().trim().max(64).optional(),
  sessionId: z.string().trim().max(64).optional().nullable(),
  location: z.string().trim().max(200).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
})

const CHECKABLE_STATUSES: readonly string[] = ["CONFIRMED", "CHECKED_IN"]

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }
  const performerId = session.user.id

  try {
    const parsed = checkInSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      const missingEvent = parsed.error.issues.some((i) => i.path[0] === "eventId")
      return NextResponse.json({ success: false, message: missingEvent ? "Event ID required" : "Invalid check-in method" }, { status: 400 })
    }
    const { method, qrData, registrationId: manualRegId, eventId, sessionId, location, notes } = parsed.data

    const authResult = await authorize(performerId, PERMISSIONS.CHECKIN_PERFORM, { eventId })
    if (!authResult.authorized) {
      return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
    }

    let registrationId: string | undefined
    let ticketId: string | undefined
    let participantInfo: { name: string; email: string; avatar?: string | null } | undefined
    let ticketInfo: { number: string; type: string } | undefined

    if (method === "QR_SCAN" && qrData) {
      // the scanned event goes in: a legacy (unsigned) ticket code is only looked up there
      const result = await validateTicketQR(qrData, { eventId })
      if (!result.valid) {
        return NextResponse.json({
          success: false,
          reason: result.reason,
          message: result.message,
        }, { status: 400 })
      }

      if (result.event?.id !== eventId) {
        return NextResponse.json({
          success: false,
          reason: "WRONG_EVENT",
          message: "This ticket is for a different event",
        }, { status: 400 })
      }

      // A ticket left active on a cancelled, rejected or unconfirmed registration does not admit.
      if (!result.registration || !CHECKABLE_STATUSES.includes(result.registration.status)) {
        return NextResponse.json({
          success: false,
          reason: "NOT_CONFIRMED",
          message: "This registration is not confirmed",
          participant: result.participant,
        }, { status: 400 })
      }

      registrationId = result.ticket!.registrationId
      ticketId = result.ticket!.id
      participantInfo = result.participant as typeof participantInfo
      ticketInfo = { number: result.ticket!.ticketNumber, type: result.ticketType!.name }
    } else if (method === "MANUAL" && manualRegId) {
      registrationId = manualRegId
      const reg = await prisma.registration.findUnique({
        where: { id: manualRegId },
        include: {
          user: { select: { name: true, email: true, avatar: true } },
          ticket: { select: { id: true, ticketNumber: true } },
          ticketType: { select: { name: true } },
        },
      })

      if (!reg || reg.eventId !== eventId) {
        return NextResponse.json({ success: false, reason: "NOT_FOUND", message: "Registration not found" }, { status: 404 })
      }

      if (!CHECKABLE_STATUSES.includes(reg.status)) {
        return NextResponse.json({ success: false, reason: "NOT_CONFIRMED", message: "Registration is not confirmed" }, { status: 400 })
      }

      ticketId = reg.ticket?.id
      participantInfo = { name: reg.user.name, email: reg.user.email, avatar: reg.user.avatar }
      ticketInfo = { number: reg.ticket?.ticketNumber || "N/A", type: reg.ticketType.name }
    } else {
      return NextResponse.json({ success: false, message: "Invalid check-in method" }, { status: 400 })
    }

    if (!registrationId) {
      return NextResponse.json({ success: false, message: "Registration not found" }, { status: 400 })
    }
    if (!ticketId) {
      // A check-in row points at the ticket; a confirmed registration always has one.
      return NextResponse.json({ success: false, reason: "NO_TICKET", message: "This registration has no ticket yet" }, { status: 400 })
    }
    const regId = registrationId
    const tktId = ticketId

    const alreadyCheckedIn = (existing: { checkedInAt: Date; performer: { name: string } | null }) =>
      NextResponse.json({
        success: false,
        reason: "ALREADY_CHECKED_IN",
        // the time itself is sent as checkedInAt; the scanner shows it on the event's clock
        message: "Already checked in",
        checkedInAt: existing.checkedInAt,
        checkedInBy: existing.performer?.name,
        participant: participantInfo,
      }, { status: 409 })

    // Check if already checked in
    const existingCheckIn = await prisma.checkIn.findFirst({
      where: {
        registrationId: regId,
        ...(sessionId ? { sessionId } : {}),
      },
      select: { id: true, checkedInAt: true, performer: { select: { name: true } } },
    })

    if (existingCheckIn) return alreadyCheckedIn(existingCheckIn)

    // Get userId from registration
    const registration = await prisma.registration.findUnique({
      where: { id: regId },
      select: { userId: true },
    })

    if (!registration) {
      return NextResponse.json({ success: false, message: "Registration not found" }, { status: 404 })
    }

    // Create the check-in and mark the registration and ticket together. Two scanners
    // reading the same ticket at once: the second insert hits the unique key and is
    // answered as "already checked in" instead of an error.
    let checkIn
    try {
      checkIn = await prisma.$transaction(async (tx) => {
        const created = await tx.checkIn.create({
          data: {
            eventId,
            userId: registration.userId,
            registrationId: regId,
            ticketId: tktId,
            sessionId: sessionId || null,
            checkedInBy: performerId,
            checkInMethod: method,
            location: location || null,
            notes: notes || null,
          },
        })
        await tx.registration.update({ where: { id: regId }, data: { status: "CHECKED_IN" } })
        await tx.ticket.update({ where: { id: tktId }, data: { status: "USED" } })
        return created
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const existing = await prisma.checkIn.findFirst({
          where: { registrationId: regId },
          select: { checkedInAt: true, performer: { select: { name: true } } },
        })
        if (existing) return alreadyCheckedIn(existing)
      }
      throw error
    }

    // The org's (and enterprise's) audit log shows who let whom in, and how.
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { organizationId: true, enterpriseId: true, organization: { select: { enterpriseId: true } } },
    })
    const { ipAddress, userAgent } = getClientInfo(request)
    await createAuditLog({
      userId: performerId,
      action: "CHECK_IN",
      entityType: "CHECK_IN",
      entityId: checkIn.id,
      description: `Checked in ${participantInfo?.name ?? "participant"} (${method === "QR_SCAN" ? "QR scan" : "manual"}, ticket ${ticketInfo?.number ?? "N/A"})`,
      newValues: { registrationId: regId, ticketId: tktId, method, sessionId: sessionId || null },
      eventId,
      organizationId: event?.organizationId ?? undefined,
      enterpriseId: event?.enterpriseId ?? event?.organization?.enterpriseId ?? undefined,
      ipAddress,
      userAgent,
    })

    return NextResponse.json({
      success: true,
      data: {
        checkIn,
        participant: participantInfo,
        ticket: ticketInfo,
        message: "Checked in successfully",
      },
    })
  } catch (error) {
    console.error("Check-in error:", error)
    return NextResponse.json({ success: false, message: "Check-in failed" }, { status: 500 })
  }
}
