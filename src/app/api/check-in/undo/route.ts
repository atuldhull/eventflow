import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { createAuditLog, getClientInfo } from "@/lib/audit"

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  try {
    const { checkInId, reason } = await request.json()
    if (!checkInId) {
      return NextResponse.json({ success: false, message: "Check-in ID required" }, { status: 400 })
    }

    const checkIn = await prisma.checkIn.findUnique({
      where: { id: checkInId },
      select: { registrationId: true, ticketId: true, eventId: true, userId: true },
    })

    if (!checkIn) {
      return NextResponse.json({ success: false, message: "Check-in not found" }, { status: 404 })
    }

    // Delete check-in
    await prisma.checkIn.delete({ where: { id: checkInId } })

    // Revert registration status
    await prisma.registration.update({
      where: { id: checkIn.registrationId },
      data: { status: "CONFIRMED" },
    })

    // Revert ticket status
    if (checkIn.ticketId) {
      await prisma.ticket.update({
        where: { id: checkIn.ticketId },
        data: { status: "ACTIVE" },
      })
    }

    const { ipAddress, userAgent } = getClientInfo(request)
    await createAuditLog({
      userId: session.user.id,
      action: "DELETE",
      entityType: "REGISTRATION",
      entityId: checkIn.registrationId,
      description: `Undid check-in${reason ? `: ${reason}` : ""}`,
      ipAddress,
      userAgent,
    })

    return NextResponse.json({ success: true, message: "Check-in reversed" })
  } catch (error) {
    console.error("Undo check-in error:", error)
    return NextResponse.json({ success: false, message: "Failed to undo check-in" }, { status: 500 })
  }
}
