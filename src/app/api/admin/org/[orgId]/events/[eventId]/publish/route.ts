import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { createAuditLog, getClientInfo } from "@/lib/audit"
import { PERMISSIONS } from "@/lib/permissions"
import {
  PAID_TICKET_WHERE,
  PENDING_APPROVAL_MESSAGE,
  notifyEventApprovers,
  paidTicketsBlocker,
  publishOutcome,
} from "@/lib/event-publishing"

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

  // Paid tickets can't go live while online payments are off or not set up.
  if ((await prisma.ticketType.count({ where: { eventId, ...PAID_TICKET_WHERE } })) > 0) {
    const blocker = await paidTicketsBlocker()
    if (blocker) return NextResponse.json({ success: false, message: blocker }, { status: 409 })
  }

  // An enterprise that requires approval gets the event as PENDING_APPROVAL instead
  const outcome = await publishOutcome(orgId, session.user.id)
  const published = outcome.status === "PUBLISHED"
  await prisma.event.update({
    where: { id: eventId },
    data: published ? { status: "PUBLISHED", publishedAt: new Date() } : { status: "PENDING_APPROVAL" },
  })
  if (!published && outcome.enterpriseId) {
    await notifyEventApprovers(outcome.enterpriseId, { id: eventId, title: event.title }, session.user.id)
  }

  const { ipAddress, userAgent } = getClientInfo(request)
  await createAuditLog({
    userId: session.user.id,
    action: published ? "PUBLISH" : "UPDATE",
    entityType: "EVENT",
    entityId: eventId,
    description: published ? `Published event: ${event.title}` : `Submitted event for approval: ${event.title}`,
    ipAddress,
    userAgent,
    eventId,
    organizationId: orgId,
    // Enterprise audit logs list entries by enterpriseId: without it submissions never show there.
    enterpriseId: outcome.enterpriseId ?? undefined,
  })

  return NextResponse.json({
    success: true,
    message: published ? "Event published successfully" : PENDING_APPROVAL_MESSAGE,
    data: { status: outcome.status },
  })
}
