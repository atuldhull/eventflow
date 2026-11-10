import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { verifyPaymentSignature } from "@/lib/razorpay-signature"
import { completeRegistrationPayment, ensureTicketForRegistration } from "@/lib/payment-completion"
import { registrationMeta } from "@/lib/registration-capacity"

// What the register page needs to show after a payment: the registration's final state
// and, once confirmed, the ticket.
async function paymentResult(registrationId: string) {
  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
    select: {
      status: true, metadata: true,
      ticket: { select: { id: true, ticketNumber: true, qrCode: true, status: true } },
    },
  })
  return {
    registrationId,
    registrationStatus: registration?.status ?? null,
    refundRequired: registrationMeta(registration?.metadata).refundRequired === true,
    ticket: registration?.ticket ?? null,
  }
}

const SEAT_LOST_MESSAGE =
  "Payment received, but no seat was left for this registration. The organizer has been asked to refund you."

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await request.json()

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return NextResponse.json({ success: false, message: "Missing payment verification data" }, { status: 400 })
  }

  const secret = process.env.RAZORPAY_KEY_SECRET
  if (!secret) {
    return NextResponse.json({ success: false, message: "Payment gateway not configured" }, { status: 503 })
  }

  const signatureValid = verifyPaymentSignature({
    orderId: String(razorpay_order_id),
    paymentId: String(razorpay_payment_id),
    signature: razorpay_signature,
    secret,
  })

  if (!signatureValid) {
    return NextResponse.json({ success: false, message: "Payment verification failed — invalid signature" }, { status: 400 })
  }

  // Find the payment record — scoped to the signed-in user to prevent IDOR
  const payment = await prisma.payment.findFirst({
    where: { gatewayOrderId: razorpay_order_id, userId: session.user.id },
    select: { id: true, registrationId: true, eventId: true, status: true },
  })

  if (!payment) {
    return NextResponse.json({ success: false, message: "Payment record not found" }, { status: 404 })
  }

  if (payment.status === "COMPLETED") {
    // If a prior verify succeeded but ticket generation failed, recover here.
    if (payment.registrationId) await ensureTicketForRegistration(payment.registrationId)
    const data = await paymentResult(payment.registrationId)
    return NextResponse.json({ success: true, message: data.refundRequired ? SEAT_LOST_MESSAGE : "Payment already verified", data })
  }

  if (!payment.registrationId) {
    return NextResponse.json({ success: false, message: "Payment is not linked to a registration" }, { status: 400 })
  }

  // Mark the payment complete and confirm the registration (using its seat hold, or
  // re-claiming the seat if the hold was released) and issue the ticket. Guarded so a
  // concurrent Razorpay webhook can't apply it twice.
  const completion = await completeRegistrationPayment(payment.id, {
    gatewayPaymentId: String(razorpay_payment_id),
    gatewaySignature: String(razorpay_signature),
  })

  if (!completion.completed) {
    const current = await prisma.payment.findUnique({ where: { id: payment.id }, select: { status: true } })
    if (current?.status === "COMPLETED") {
      const data = await paymentResult(payment.registrationId)
      return NextResponse.json({ success: true, message: data.refundRequired ? SEAT_LOST_MESSAGE : "Payment already verified", data })
    }
    return NextResponse.json({ success: false, message: "This payment can no longer be completed" }, { status: 409 })
  }

  const data = await paymentResult(payment.registrationId)
  return NextResponse.json({
    success: true,
    message: completion.refundRequired ? SEAT_LOST_MESSAGE : "Payment verified successfully",
    data,
  })
}
