import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
// Lazy init to avoid crash when keys not set
let _razorpay: any = null
function getRazorpay() {
  if (!_razorpay) {
    const Razorpay = require("razorpay")
    _razorpay = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET })
  }
  return _razorpay
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { registrationId, amount, currency = "INR" } = await request.json()

  if (!registrationId || !amount || amount <= 0) {
    return NextResponse.json({ success: false, message: "Registration ID and valid amount required" }, { status: 400 })
  }

  // Verify registration exists and belongs to this user
  const registration = await prisma.registration.findFirst({
    where: { id: registrationId, userId: session.user.id },
    select: { id: true, status: true, event: { select: { title: true, id: true } } },
  })

  if (!registration) {
    return NextResponse.json({ success: false, message: "Registration not found" }, { status: 404 })
  }

  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    return NextResponse.json({ success: false, message: "Payment gateway not configured" }, { status: 503 })
  }

  try {
    const order = await getRazorpay().orders.create({
      amount: Math.round(amount * 100), // Razorpay expects paise
      currency,
      receipt: `reg_${registrationId}`,
      notes: {
        registrationId,
        eventId: registration.event.id,
        userId: session.user.id,
      },
    })

    // Create payment record in PENDING state
    const paymentNumber = `PAY-${Date.now().toString(36).toUpperCase()}`
    await prisma.payment.create({
      data: {
        registrationId,
        userId: session.user.id,
        eventId: registration.event.id,
        amount,
        currency,
        status: "PENDING",
        method: "RAZORPAY",
        paymentNumber,
        gatewayOrderId: order.id,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
        paymentNumber,
      },
    })
  } catch (error: any) {
    console.error("Razorpay order creation failed:", error)
    return NextResponse.json({ success: false, message: error.message || "Failed to create payment order" }, { status: 500 })
  }
}
