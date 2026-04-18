import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"

// Lazy init to avoid crash when keys not set
type RazorpayClient = {
  orders: { create: (opts: Record<string, unknown>) => Promise<{ id: string; amount: number; currency: string }> }
}
let _razorpay: RazorpayClient | null = null
function getRazorpay(): RazorpayClient {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set")
  }
  if (!_razorpay) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Razorpay = require("razorpay")
    _razorpay = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET }) as RazorpayClient
  }
  return _razorpay
}

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

  if (!payment) {
    return NextResponse.json({ success: false, message: "No payment pending for this registration" }, { status: 404 })
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

  // If we already created a gateway order and the payment is still PENDING, re-use it (idempotency)
  if (payment.gatewayOrderId) {
    return NextResponse.json({
      success: true,
      data: {
        orderId: payment.gatewayOrderId,
        amount: Math.round(amount * 100),
        currency: payment.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
        paymentNumber: payment.paymentNumber,
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
      },
    })
  } catch (error) {
    console.error("Razorpay order creation failed:", error)
    return NextResponse.json({ success: false, message: "Failed to create payment order" }, { status: 500 })
  }
}
