import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { getClientInfo } from "@/lib/audit"
import { PERMISSIONS } from "@/lib/permissions"
import { refundAllForEvent } from "@/lib/org-refund"

// Refunds every payment of a cancelled event that still holds money: the retry for
// refunds that didn't go through when the event was cancelled (Razorpay refused, keys
// missing, or the organizer chose to refund later). Live events are refused, so a slip
// can't refund an event that is still happening; single refunds use the payment route.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; eventId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { orgId, eventId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.PAYMENT_MANAGE, { organizationId: orgId })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  const event = await prisma.event.findFirst({
    where: { id: eventId, organizationId: orgId },
    select: { status: true, cancellationReason: true },
  })
  if (!event) {
    return NextResponse.json({ success: false, message: "Event not found" }, { status: 404 })
  }
  if (event.status !== "CANCELLED") {
    return NextResponse.json({ success: false, message: "Only a cancelled event's payments can be refunded all at once" }, { status: 400 })
  }

  const summary = await refundAllForEvent({
    orgId, eventId, actorId: session.user.id,
    reason: `Event cancelled${event.cancellationReason ? `: ${event.cancellationReason}` : ""}`.slice(0, 500),
    audit: getClientInfo(request),
  })

  const s = (n: number) => (n === 1 ? "" : "s")
  if (summary.attempted === 0) {
    return NextResponse.json({ success: true, message: "Nothing left to refund for this event", data: summary })
  }
  const message = summary.failed.length === 0
    ? `${summary.refunded} payment${s(summary.refunded)} refunded`
    : `${summary.refunded} of ${summary.attempted} refunded. ${summary.failed.length} failed: ${summary.failed[0].message}`
  return NextResponse.json({ success: summary.failed.length === 0, message, data: summary }, { status: summary.failed.length === 0 ? 200 : 207 })
}
