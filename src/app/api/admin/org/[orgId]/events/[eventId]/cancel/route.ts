import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { createAuditLog, getClientInfo } from "@/lib/audit"
import { PERMISSIONS } from "@/lib/permissions"
import { z } from "zod/v4"

const cancelSchema = z.object({ reason: z.string().min(1, "Reason is required") })

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; eventId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { orgId, eventId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.EVENT_CANCEL, { organizationId: orgId })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  const body = await request.json()
  const parsed = cancelSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "Reason is required" }, { status: 400 })
  }

  const event = await prisma.event.findFirst({
    where: { id: eventId, organizationId: orgId, deletedAt: null },
    select: { title: true, status: true },
  })

  if (!event) {
    return NextResponse.json({ success: false, message: "Event not found" }, { status: 404 })
  }

  if (event.status === "CANCELLED") {
    return NextResponse.json({ success: false, message: "Event is already cancelled" }, { status: 400 })
  }

  await prisma.event.update({
    where: { id: eventId },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancellationReason: parsed.data.reason },
  })

  // Cancel all pending/confirmed registrations
  await prisma.registration.updateMany({
    where: { eventId, status: { in: ["PENDING", "CONFIRMED", "WAITLISTED"] } },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancellationReason: "Event cancelled" },
  })

  const { ipAddress, userAgent } = getClientInfo(request)
  await createAuditLog({
    userId: session.user.id,
    action: "CANCEL",
    entityType: "EVENT",
    entityId: eventId,
    description: `Cancelled event: ${event.title}. Reason: ${parsed.data.reason}`,
    ipAddress,
    userAgent,
    organizationId: orgId,
  })

  return NextResponse.json({ success: true, message: "Event cancelled" })
}
