import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { countsAgainstCapacity, hasActiveHold, releaseEventSeat, releaseStockAndCoupon } from "@/lib/registration-capacity"
import { releaseSeatHoldInTx } from "@/lib/seat-hold"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ registrationId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { registrationId } = await params

  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
    select: {
      id: true, userId: true, status: true, eventId: true, metadata: true,
      event: { select: { title: true, startDate: true } },
      payment: { select: { couponId: true } },
    },
  })

  if (!registration) {
    return NextResponse.json({ success: false, message: "Registration not found" }, { status: 404 })
  }

  if (registration.userId !== session.user.id) {
    return NextResponse.json({ success: false, message: "Not your registration" }, { status: 403 })
  }

  if (registration.status === "CANCELLED") {
    return NextResponse.json({ success: false, message: "Already cancelled" }, { status: 400 })
  }

  if (registration.status === "CHECKED_IN") {
    return NextResponse.json({ success: false, message: "Cannot cancel after check-in" }, { status: 400 })
  }

  // Don't allow cancellation if event already started
  if (new Date(registration.event.startDate) < new Date()) {
    return NextResponse.json({ success: false, message: "Cannot cancel after event has started" }, { status: 400 })
  }

  const couponId = registration.payment?.couponId

  const cancelled = await prisma.$transaction(async (tx) => {
    // A paid registration still holding its seat: release the hold (seat, ticket stock and
    // coupon use back; open payment marked FAILED).
    if (hasActiveHold(registration) && await releaseSeatHoldInTx(tx, registrationId, "cancelled")) {
      return true
    }

    // Guarded on the status we read, so a double submit can't release the seat twice.
    const current = await tx.registration.findUnique({ where: { id: registrationId }, select: { status: true, metadata: true, ticketTypeId: true } })
    if (!current || current.status === "CANCELLED") return false
    const { count } = await tx.registration.updateMany({
      where: { id: registrationId, status: current.status },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancellationReason: "Cancelled by attendee" },
    })
    if (count === 0) return false
    await tx.ticket.updateMany({ where: { registrationId }, data: { status: "CANCELLED" } })
    // Only registrations that hold a seat give one back (not ones still awaiting approval).
    if (countsAgainstCapacity(current)) await releaseEventSeat(tx, registration.eventId)
    // Ticket stock and coupon use go back once; the flags stop a later refund repeating it.
    const metadata = await releaseStockAndCoupon(tx, current, couponId)
    await tx.registration.update({ where: { id: registrationId }, data: { metadata } })
    return true
  })

  if (!cancelled) {
    return NextResponse.json({ success: false, message: "Already cancelled" }, { status: 400 })
  }

  return NextResponse.json({ success: true, message: "Registration cancelled successfully" })
}
