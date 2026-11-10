import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { z } from "zod/v4"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { createAuditLog, getClientInfo } from "@/lib/audit"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"

const undoSchema = z.object({
  checkInId: z.string().trim().min(1).max(64),
  eventId: z.string().trim().max(64).optional(),
  reason: z.string().trim().max(500).optional(),
})

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  try {
    const parsed = undoSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: "Check-in ID required" }, { status: 400 })
    }
    const { checkInId, reason, eventId } = parsed.data

    const checkIn = await prisma.checkIn.findUnique({
      where: { id: checkInId },
      select: {
        registrationId: true, ticketId: true, eventId: true, userId: true, checkInMethod: true, checkedInAt: true,
        user: { select: { name: true } },
        event: { select: { organizationId: true, enterpriseId: true, organization: { select: { enterpriseId: true } } } },
      },
    })

    // An eventId sent by the client (optional) must match the check-in's own event.
    if (!checkIn || (eventId && eventId !== checkIn.eventId)) {
      return NextResponse.json({ success: false, message: "Check-in not found" }, { status: 404 })
    }

    // Same gate as performing a check-in, scoped to the event the check-in belongs to
    // (event team, owning org, or parent enterprise). Participants and admins of other
    // tenants cannot reverse it.
    const authResult = await authorize(session.user.id, PERMISSIONS.CHECKIN_PERFORM, { eventId: checkIn.eventId })
    if (!authResult.authorized) {
      return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
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
    // Scoped like the check-in itself, so the org's audit log shows both.
    await createAuditLog({
      userId: session.user.id,
      action: "DELETE",
      entityType: "CHECK_IN",
      entityId: checkInId,
      description: `Undid check-in of ${checkIn.user?.name ?? "participant"}${reason ? `: ${reason}` : ""}`,
      oldValues: {
        registrationId: checkIn.registrationId,
        ticketId: checkIn.ticketId,
        method: checkIn.checkInMethod ?? null,
        checkedInAt: checkIn.checkedInAt ? new Date(checkIn.checkedInAt).toISOString() : null,
      },
      eventId: checkIn.eventId,
      organizationId: checkIn.event?.organizationId ?? undefined,
      enterpriseId: checkIn.event?.enterpriseId ?? checkIn.event?.organization?.enterpriseId ?? undefined,
      ipAddress,
      userAgent,
    })

    return NextResponse.json({ success: true, message: "Check-in reversed" })
  } catch (error) {
    console.error("Undo check-in error:", error)
    return NextResponse.json({ success: false, message: "Failed to undo check-in" }, { status: 500 })
  }
}
