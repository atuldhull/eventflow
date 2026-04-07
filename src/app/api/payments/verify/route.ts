import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import crypto from "crypto"

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await request.json()

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return NextResponse.json({ success: false, message: "Missing payment verification data" }, { status: 400 })
  }

  // Verify signature
  const secret = process.env.RAZORPAY_KEY_SECRET
  if (!secret) {
    return NextResponse.json({ success: false, message: "Payment gateway not configured" }, { status: 503 })
  }

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex")

  if (expectedSignature !== razorpay_signature) {
    return NextResponse.json({ success: false, message: "Payment verification failed — invalid signature" }, { status: 400 })
  }

  // Find the payment record
  const payment = await prisma.payment.findFirst({
    where: { gatewayOrderId: razorpay_order_id, userId: session.user.id },
    select: { id: true, registrationId: true, eventId: true, status: true },
  })

  if (!payment) {
    return NextResponse.json({ success: false, message: "Payment record not found" }, { status: 404 })
  }

  if (payment.status === "COMPLETED") {
    return NextResponse.json({ success: true, message: "Payment already verified" })
  }

  // Update payment + registration + event in transaction
  await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "COMPLETED",
        gatewayPaymentId: razorpay_payment_id,
        gatewaySignature: razorpay_signature,
        paidAt: new Date(),
      },
    }),
    prisma.registration.update({
      where: { id: payment.registrationId! },
      data: { status: "CONFIRMED" },
    }),
    prisma.event.update({
      where: { id: payment.eventId },
      data: { currentRegistrations: { increment: 1 } },
    }),
  ])

  // Generate ticket
  const reg = await prisma.registration.findUnique({
    where: { id: payment.registrationId! },
    select: { registrationNumber: true, ticketTypeId: true },
  })

  if (reg) {
    const ticketNum = `TKT-${Date.now().toString(36).toUpperCase()}`
    const { createQRPayload } = await import("@/lib/ticket")
    const qrData = createQRPayload(ticketNum, payment.eventId, reg.registrationNumber)
    await prisma.ticket.create({
      data: {
        registrationId: payment.registrationId!,
        userId: session.user.id,
        eventId: payment.eventId,
        ticketTypeId: reg.ticketTypeId || "",
        ticketNumber: ticketNum,
        qrCode: qrData,
        status: "ACTIVE",
      },
    })
  }

  return NextResponse.json({ success: true, message: "Payment verified successfully" })
}
