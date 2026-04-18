import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { validateTicketQR } from "@/lib/ticket"
import { createAuditLog, getClientInfo } from "@/lib/audit"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { method, qrData, registrationId: manualRegId, eventId, sessionId, location, notes } = body

    if (!eventId) {
      return NextResponse.json({ success: false, message: "Event ID required" }, { status: 400 })
    }

    const authResult = await authorize(session.user.id, PERMISSIONS.CHECKIN_PERFORM, { eventId })
    if (!authResult.authorized) {
      return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
    }

    let registrationId: string | undefined
    let ticketId: string | undefined
    let participantInfo: { name: string; email: string; avatar?: string | null } | undefined
    let ticketInfo: { number: string; type: string } | undefined

    if (method === "QR_SCAN" && qrData) {
      const result = await validateTicketQR(qrData)
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

      const ticket = await prisma.ticket.findUnique({
        where: { ticketNumber: result.ticket!.ticketNumber },
        select: { id: true, registrationId: true },
      })

      registrationId = ticket?.registrationId
      ticketId = ticket?.id
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

      if (!["CONFIRMED", "CHECKED_IN"].includes(reg.status)) {
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

    // Check if already checked in
    const existingCheckIn = await prisma.checkIn.findFirst({
      where: {
        registrationId,
        ...(sessionId ? { sessionId } : {}),
      },
      select: { id: true, checkedInAt: true, performer: { select: { name: true } } },
    })

    if (existingCheckIn) {
      return NextResponse.json({
        success: false,
        reason: "ALREADY_CHECKED_IN",
        message: `Already checked in at ${existingCheckIn.checkedInAt.toLocaleTimeString()}`,
        checkedInAt: existingCheckIn.checkedInAt,
        checkedInBy: existingCheckIn.performer.name,
        participant: participantInfo,
      }, { status: 409 })
    }

    // Get userId from registration
    const registration = await prisma.registration.findUnique({
      where: { id: registrationId },
      select: { userId: true },
    })

    if (!registration) {
      return NextResponse.json({ success: false, message: "Registration not found" }, { status: 404 })
    }

    // Create check-in
    const checkIn = await prisma.checkIn.create({
      data: {
        eventId,
        userId: registration.userId,
        registrationId,
        ticketId: ticketId || "",
        sessionId: sessionId || null,
        checkedInBy: session.user.id,
        checkInMethod: method,
        location: location || null,
        notes: notes || null,
      },
    })

    // Update registration and ticket status
    await prisma.registration.update({
      where: { id: registrationId },
      data: { status: "CHECKED_IN" },
    })

    if (ticketId) {
      await prisma.ticket.update({
        where: { id: ticketId },
        data: { status: "USED" },
      })
    }

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
