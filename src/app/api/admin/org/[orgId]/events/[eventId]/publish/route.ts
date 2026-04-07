import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { createAuditLog, getClientInfo } from "@/lib/audit"
import { PERMISSIONS } from "@/lib/permissions"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; eventId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { orgId, eventId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.EVENT_PUBLISH, { organizationId: orgId })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  const event = await prisma.event.findFirst({
    where: { id: eventId, organizationId: orgId, deletedAt: null },
    select: { title: true, status: true, startDate: true, endDate: true },
  })

  if (!event) {
    return NextResponse.json({ success: false, message: "Event not found" }, { status: 404 })
  }

  if (event.status !== "DRAFT") {
    return NextResponse.json({ success: false, message: "Only draft events can be published" }, { status: 400 })
  }

  const ticketCount = await prisma.ticketType.count({ where: { eventId } })
  if (ticketCount === 0) {
    return NextResponse.json({ success: false, message: "Event must have at least one ticket type" }, { status: 400 })
  }

  await prisma.event.update({
    where: { id: eventId },
    data: { status: "PUBLISHED", publishedAt: new Date() },
  })

  const { ipAddress, userAgent } = getClientInfo(request)
  await createAuditLog({
    userId: session.user.id,
    action: "PUBLISH",
    entityType: "EVENT",
    entityId: eventId,
    description: `Published event: ${event.title}`,
    ipAddress,
    userAgent,
    organizationId: orgId,
  })

  return NextResponse.json({ success: true, message: "Event published successfully" })
}
