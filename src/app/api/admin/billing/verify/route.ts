import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { getClientInfo } from "@/lib/audit"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"
import { activatePlan, getPlanAmount, PLAN_ORDER_PURPOSE } from "@/lib/billing"
import { getOrderNotes, getRazorpay, isRazorpayConfigured, type RazorpayOrder } from "@/lib/razorpay"
import { verifyPaymentSignature } from "@/lib/razorpay-signature"
import { z } from "zod/v4"

const verifySchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
  plan: z.enum(["STARTER", "PRO", "ENTERPRISE"]),
  billingInterval: z.enum(["MONTHLY", "YEARLY"]),
  entityType: z.enum(["enterprise", "org"]),
  entityId: z.string().min(1),
})

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const parsed = verifySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: "Missing payment verification data" }, { status: 400 })
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan, billingInterval, entityType, entityId } = parsed.data

    const { authorized, message } = await authorize(
      session.user.id,
      entityType === "org" ? PERMISSIONS.ORG_MANAGE_SETTINGS : PERMISSIONS.ENTERPRISE_MANAGE_BILLING,
      entityType === "org" ? { organizationId: entityId } : { enterpriseId: entityId }
    )
    if (!authorized) {
      return NextResponse.json({ success: false, message }, { status: 403 })
    }

    if (!isRazorpayConfigured()) {
      return NextResponse.json({ success: false, message: "Payments are not configured" }, { status: 503 })
    }

    const signatureValid = verifyPaymentSignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
      secret: process.env.RAZORPAY_KEY_SECRET,
    })
    if (!signatureValid) {
      return NextResponse.json({ success: false, message: "Payment verification failed — invalid signature" }, { status: 400 })
    }

    // The signature proves the payment belongs to the order. The order itself (created
    // server-side by /subscribe) tells us what was bought, for whom, and for how much.
    let order: RazorpayOrder
    try {
      order = await getRazorpay().orders.fetch(razorpay_order_id)
    } catch (error) {
      console.error("Razorpay order fetch failed:", error)
      return NextResponse.json({ success: false, message: "Could not confirm the payment with the gateway" }, { status: 502 })
    }

    const notes = getOrderNotes(order)
    const orderMatches =
      notes.purpose === PLAN_ORDER_PURPOSE &&
      notes.entityType === entityType &&
      notes.entityId === entityId &&
      notes.plan === plan &&
      notes.billingInterval === billingInterval
    if (!orderMatches) {
      return NextResponse.json({ success: false, message: "This payment is not for the selected plan" }, { status: 400 })
    }

    const price = getPlanAmount(plan, billingInterval)
    if (price <= 0 || order.currency !== "INR" || Number(order.amount) !== Math.round(price * 100)) {
      return NextResponse.json({ success: false, message: "Payment amount does not match the plan price" }, { status: 400 })
    }

    // The audit entry is written inside activatePlan's transaction, so only the call that
    // actually activates (this one or the payment webhook, whichever runs first) logs it.
    const { ipAddress, userAgent } = getClientInfo(request)
    const { subscription, alreadyApplied } = await activatePlan({
      entityType,
      entityId,
      plan,
      billingInterval,
      payment: { orderId: razorpay_order_id, paymentId: razorpay_payment_id },
      audit: {
        userId: session.user.id,
        description: `Subscribed to ${plan} plan (${billingInterval})`,
        newValues: { plan, billingInterval, price, gatewayOrderId: razorpay_order_id, gatewayPaymentId: razorpay_payment_id },
        ipAddress,
        userAgent,
      },
    })

    if (alreadyApplied) {
      return NextResponse.json({ success: true, message: "Payment already verified", data: subscription })
    }

    return NextResponse.json({ success: true, message: "Payment verified — plan activated", data: subscription })
  } catch (error) {
    console.error("Billing verify error:", error)
    return NextResponse.json({ success: false, message: "Failed to verify payment" }, { status: 500 })
  }
}
