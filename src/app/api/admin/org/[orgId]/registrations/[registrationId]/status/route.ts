import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { createAuditLog, getClientInfo } from "@/lib/audit"
import { PERMISSIONS } from "@/lib/permissions"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; registrationId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { orgId, registrationId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.REGISTRATION_APPROVE, { organizationId: orgId })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  const body = await request.json()
  const { status, reason } = body as { status: string; reason?: string }

  if (!["CONFIRMED", "REJECTED", "CANCELLED", "WAITLISTED"].includes(status)) {
    return NextResponse.json({ success: false, message: "Invalid status" }, { status: 400 })
  }

  const registration = await prisma.registration.findFirst({
    where: { id: registrationId, event: { organizationId: orgId } },
    select: { id: true, status: true, userId: true, eventId: true, event: { select: { title: true, currentRegistrations: true } } },
  })

  if (!registration) {
    return NextResponse.json({ success: false, message: "Registration not found" }, { status: 404 })
  }

  // Update registration status
  await prisma.registration.update({
    where: { id: registrationId },
    data: {
      status: status as any,
      ...(reason ? { notes: reason } : {}),
    },
  })

  // Update event registration count if confirming
  if (status === "CONFIRMED" && registration.status === "PENDING") {
    await prisma.event.update({
      where: { id: registration.eventId },
      data: { currentRegistrations: { increment: 1 } },
    })
  }

  // Decrement count if rejecting/cancelling a confirmed registration
  if (["REJECTED", "CANCELLED"].includes(status) && registration.status === "CONFIRMED") {
    await prisma.event.update({
      where: { id: registration.eventId },
      data: { currentRegistrations: { decrement: 1 } },
    })
  }

  // Create notification for the user
  await prisma.notification.create({
    data: {
      userId: registration.userId,
      type: "REGISTRATION" as any,
      category: "REGISTRATION" as any,
      title: status === "CONFIRMED" ? "Registration Approved" : status === "REJECTED" ? "Registration Rejected" : `Registration ${status}`,
      message: status === "CONFIRMED"
        ? `Your registration for "${registration.event.title}" has been approved!`
        : status === "REJECTED"
        ? `Your registration for "${registration.event.title}" was rejected.${reason ? ` Reason: ${reason}` : ""}`
        : `Your registration status for "${registration.event.title}" has been updated to ${status}.`,
    },
  })

  const { ipAddress, userAgent } = getClientInfo(request)
  await createAuditLog({
    userId: session.user.id,
    action: "UPDATE",
    entityType: "REGISTRATION",
    entityId: registrationId,
    description: `${status} registration for ${registration.event.title}${reason ? `: ${reason}` : ""}`,
    ipAddress, userAgent, organizationId: orgId,
  })

  return NextResponse.json({ success: true, message: `Registration ${status.toLowerCase()}` })
}
