import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { createAuditLog, getClientInfo } from "@/lib/audit"
import { PERMISSIONS } from "@/lib/permissions"
import { z } from "zod/v4"
import { activeRegistrants, notifyEventCancelled } from "@/lib/event-cancellation"
import { refundAllForEvent, type RefundAllSummary } from "@/lib/org-refund"

const cancelSchema = z.object({
  reason: z.string().trim().min(1, "Reason is required").max(1000, "Keep the reason under 1000 characters"),
  // Paid tickets are refunded by default; an organizer who will pay people back some other
  // way can turn it off and refund later from the Payments page.
  refundPayments: z.boolean().optional().default(true),
})

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

  const body = await request.json().catch(() => null)
  const parsed = cancelSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || "Reason is required" }, { status: 400 })
  }
  const { reason, refundPayments } = parsed.data

  const event = await prisma.event.findFirst({
    where: { id: eventId, organizationId: orgId, deletedAt: null },
    select: { title: true, status: true, enterpriseId: true, organization: { select: { name: true } } },
  })

  if (!event) {
    return NextResponse.json({ success: false, message: "Event not found" }, { status: 404 })
  }

  if (event.status === "CANCELLED") {
    return NextResponse.json({ success: false, message: "Event is already cancelled" }, { status: 400 })
  }

  // Who to tell, read before their registrations are cancelled below.
  const recipients = await activeRegistrants(eventId)

  // Conditional update: of two cancels racing, only one changes the row, so registrants
  // are notified once.
  const cancelled = await prisma.event.updateMany({
    where: { id: eventId, organizationId: orgId, status: { not: "CANCELLED" } },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancellationReason: reason },
  })
  if (cancelled.count === 0) {
    return NextResponse.json({ success: false, message: "Event is already cancelled" }, { status: 400 })
  }

  // Cancel all pending/confirmed registrations, void their tickets (they used to stay
  // ACTIVE, so "My tickets" still showed a valid-looking ticket) and give the seats back:
  // only check-ins / no-shows still count.
  await prisma.$transaction(async (tx) => {
    const open = await tx.registration.findMany({
      where: { eventId, status: { in: ["PENDING", "CONFIRMED", "WAITLISTED"] } },
      select: { id: true },
    })
    const ids = open.map((r) => r.id)
    await tx.registration.updateMany({
      where: { id: { in: ids } },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancellationReason: "Event cancelled" },
    })
    await tx.ticket.updateMany({ where: { registrationId: { in: ids }, status: "ACTIVE" }, data: { status: "CANCELLED" } })
    const stillCounted = await tx.registration.count({ where: { eventId, status: { in: ["CHECKED_IN", "NO_SHOW"] } } })
    await tx.event.update({ where: { id: eventId }, data: { currentRegistrations: stillCounted } })
  })

  // Close payments still awaiting checkout (seat holds) so they can't be paid any more.
  await prisma.payment.updateMany({
    where: { eventId, status: { in: ["PENDING", "PROCESSING"] } },
    data: { status: "FAILED", failedAt: new Date(), failureReason: "Event cancelled" },
  })

  const client = getClientInfo(request)

  // Money back for everyone who paid (each buyer also gets a "Refund processed" email).
  // A refund Razorpay refuses (or missing keys) is reported, not hidden: the organizer can
  // retry from the Payments page ("Refund all" for this event).
  let refunds: RefundAllSummary | null = null
  if (refundPayments) {
    try {
      refunds = await refundAllForEvent({
        orgId, eventId, actorId: session.user.id, reason: `Event cancelled: ${reason}`.slice(0, 500), limit: 500, audit: client,
      })
    } catch (error) {
      console.error("Refunds after event cancellation failed:", error)
    }
  }

  // In-app notification and email, with the reason, for everyone who was still registered.
  let notified = 0
  try {
    notified = await notifyEventCancelled({
      event: { id: eventId, title: event.title },
      reason,
      organizerName: event.organization?.name ?? "The organizer",
      senderId: session.user.id,
      recipients,
      refundsIssued: !!refunds && refunds.failed.length === 0 && refunds.remaining === 0,
    })
  } catch (error) {
    console.error("Event cancellation notifications failed:", error)
  }

  const { ipAddress, userAgent } = client
  await createAuditLog({
    userId: session.user.id,
    action: "CANCEL",
    entityType: "EVENT",
    entityId: eventId,
    description: `Cancelled event: ${event.title}. Reason: ${reason}`,
    newValues: { reason, notified, refundPayments, refunded: refunds?.refunded ?? 0, refundsOutstanding: refunds?.remaining ?? 0 },
    ipAddress,
    userAgent,
    eventId,
    organizationId: orgId,
    enterpriseId: event.enterpriseId ?? undefined,
  })

  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`
  const parts = [notified > 0 ? `Event cancelled. ${notified} registrant${notified === 1 ? " was" : "s were"} notified.` : "Event cancelled."]
  if (refunds && refunds.refunded > 0) parts.push(`${plural(refunds.refunded, "payment")} refunded.`)
  if (refunds && refunds.remaining > 0) {
    parts.push(`${plural(refunds.remaining, "payment")} still to refund; open Payments to retry${refunds.failed[0] ? ` (${refunds.failed[0].message})` : ""}.`)
  }
  return NextResponse.json({
    success: true,
    message: parts.length === 1 && notified === 0 ? "Event cancelled" : parts.join(" "),
    data: {
      notified,
      refunds: refunds ? { refunded: refunds.refunded, failed: refunds.failed.length, remaining: refunds.remaining } : null,
    },
  })
}
