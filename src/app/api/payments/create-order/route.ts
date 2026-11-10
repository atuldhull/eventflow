import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { getRazorpay, isRazorpayConfigured } from "@/lib/razorpay"
import { holdExpiresAt, holdIsReclaimable } from "@/lib/registration-capacity"
import { releaseExpiredHolds, reholdReleasedRegistration } from "@/lib/seat-hold"
import { getActivePlatformSettings } from "@/lib/platform-settings-store"
import { liveWorkspaceWhere } from "@/lib/public-events"
import { reportError } from "@/lib/error-reporting"

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { registrationId } = await request.json()

  if (!registrationId) {
    return NextResponse.json({ success: false, message: "Registration ID required" }, { status: 400 })
  }

  // The Payment record is created by /api/registrations when amount > 0.
  // We look it up rather than recomputing (to keep quantity + coupon discount correct) and
  // reject any cross-user access.
  const payment = await prisma.payment.findFirst({
    where: { registrationId, userId: session.user.id },
    select: {
      id: true, status: true, amount: true, currency: true, paymentNumber: true, gatewayOrderId: true,
      registration: { select: { event: { select: { id: true, title: true, isPaid: true } } } },
    },
  })

  // CANCELLED: the payment of an earlier attempt, closed when the registration was reused
  // for a free one.
  if (!payment || payment.status === "CANCELLED") {
    return NextResponse.json({ success: false, message: "No payment pending for this registration" }, { status: 404 })
  }

  // No checkout for a deleted event, or one whose organization or enterprise is deactivated
  // or deleted: like its public page, it's "not found".
  const eventId = payment.registration?.event.id
  if (eventId) {
    const liveEvent = await prisma.event.findFirst({ where: { id: eventId, deletedAt: null, ...liveWorkspaceWhere() }, select: { id: true } })
    if (!liveEvent) {
      return NextResponse.json({ success: false, message: "Event not found" }, { status: 404 })
    }
  }

  if (payment.status === "COMPLETED") {
    return NextResponse.json({ success: false, message: "This registration is already paid" }, { status: 400 })
  }

  if (payment.status === "REFUNDED") {
    return NextResponse.json({ success: false, message: "This payment has been refunded" }, { status: 400 })
  }

  if (!payment.registration?.event.isPaid) {
    return NextResponse.json({ success: false, message: "No payment required for this registration" }, { status: 400 })
  }

  const amount = Number(payment.amount)
  if (amount <= 0) {
    return NextResponse.json({ success: false, message: "Invalid payment amount" }, { status: 400 })
  }

  if (!isRazorpayConfigured()) {
    return NextResponse.json({ success: false, message: "Payments are not configured" }, { status: 503 })
  }
  // Platform settings → Features → Payment processing. Same 503 as an unconfigured gateway:
  // the register page then tells the buyer their seat is held and to contact the organizer.
  if (!(await getActivePlatformSettings()).features.paymentProcessing) {
    return NextResponse.json({ success: false, message: "Online payments are turned off right now" }, { status: 503 })
  }

  // Seat hold: release it if it has run out, then take a fresh one if the buyer is
  // retrying after the hold expired or a payment attempt failed.
  await releaseExpiredHolds({ registrationId })
  let registration = await prisma.registration.findUniqueOrThrow({
    where: { id: registrationId },
    select: { status: true, metadata: true },
  })
  if (holdIsReclaimable(registration)) {
    const rehold = await reholdReleasedRegistration(registrationId)
    if (!rehold.ok) {
      const message = rehold.reason === "TICKETS_SOLD_OUT"
        ? "Your seat hold expired and this ticket has sold out since."
        : "Your seat hold expired and the event is now full."
      return NextResponse.json({ success: false, message }, { status: 409 })
    }
    registration = await prisma.registration.findUniqueOrThrow({
      where: { id: registrationId },
      select: { status: true, metadata: true },
    })
  }

  if (registration.status === "CANCELLED" || registration.status === "REJECTED") {
    return NextResponse.json({ success: false, message: `This registration has been ${registration.status.toLowerCase()}` }, { status: 400 })
  }
  if (registration.status === "WAITLISTED") {
    return NextResponse.json({ success: false, message: "You're on the waitlist. Payment opens once the organizer confirms a seat for you." }, { status: 400 })
  }

  const holdUntil = holdExpiresAt(registration)?.toISOString() ?? null

  // If we already created a gateway order and the payment is still open, re-use it (idempotency)
  if (payment.gatewayOrderId) {
    return NextResponse.json({
      success: true,
      data: {
        orderId: payment.gatewayOrderId,
        amount: Math.round(amount * 100),
        currency: payment.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
        paymentNumber: payment.paymentNumber,
        holdExpiresAt: holdUntil,
      },
    })
  }

  try {
    const order = await getRazorpay().orders.create({
      amount: Math.round(amount * 100), // Razorpay expects paise
      currency: payment.currency,
      receipt: `reg_${registrationId}`,
      notes: {
        registrationId,
        eventId: payment.registration.event.id,
        userId: session.user.id,
      },
    })

    await prisma.payment.update({
      where: { id: payment.id },
      data: { gatewayOrderId: order.id },
    })

    return NextResponse.json({
      success: true,
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
        paymentNumber: payment.paymentNumber,
        holdExpiresAt: holdUntil,
      },
    })
  } catch (error) {
    console.error("Razorpay order creation failed:", error)
    // Usually wrong or missing Razorpay keys, or Razorpay being down: the operator must know
    void reportError(error, { where: "POST /api/payments/create-order", extra: { reason: "Razorpay order creation failed" } })
    const until = holdUntil ? ` Your seat stays held until ${new Date(holdUntil).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })}.` : ""
    return NextResponse.json({
      success: false,
      message: `We couldn't start the payment just now. Nothing was charged.${until} Please try again in a minute; if it keeps failing, contact the organizer.`,
    }, { status: 502 })
  }
}
