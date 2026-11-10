import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { createAuditLog, getClientInfo } from "@/lib/audit"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"
import { activatePlan, getPlanAmount, PLAN_ORDER_PURPOSE } from "@/lib/billing"
import { getRazorpay, isRazorpayConfigured } from "@/lib/razorpay"
import { z } from "zod/v4"
import { reportError } from "@/lib/error-reporting"

const subscribeSchema = z.object({
  plan: z.enum(["FREE", "STARTER", "PRO", "ENTERPRISE"]),
  billingInterval: z.enum(["MONTHLY", "YEARLY"]).default("MONTHLY"),
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
    const parsed = subscribeSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: "Validation failed" }, { status: 400 })
    }

    const { plan, billingInterval, entityType, entityId } = parsed.data

    const { authorized, message } = await authorize(
      session.user.id,
      entityType === "org" ? PERMISSIONS.ORG_MANAGE_SETTINGS : PERMISSIONS.ENTERPRISE_MANAGE_BILLING,
      entityType === "org" ? { organizationId: entityId } : { enterpriseId: entityId }
    )
    if (!authorized) {
      return NextResponse.json({ success: false, message }, { status: 403 })
    }

    // The price always comes from server-side plan config, never from the request.
    const price = getPlanAmount(plan, billingInterval)

    // Paid plans are only activated by /api/admin/billing/verify after a verified
    // Razorpay payment. Here we just open the order.
    if (plan !== "FREE") {
      // ENTERPRISE has no list price (custom contract), so it can't be self-served.
      if (price <= 0) {
        return NextResponse.json({ success: false, message: "This plan requires a custom quote. Please contact sales." }, { status: 400 })
      }
      if (!isRazorpayConfigured()) {
        return NextResponse.json({ success: false, message: "Payments are not configured" }, { status: 503 })
      }

      try {
        const order = await getRazorpay().orders.create({
          amount: Math.round(price * 100), // Razorpay expects paise
          currency: "INR",
          receipt: `plan_${Date.now()}`,
          notes: {
            purpose: PLAN_ORDER_PURPOSE,
            entityType,
            entityId,
            plan,
            billingInterval,
            userId: session.user.id,
          },
        })

        return NextResponse.json({
          success: true,
          message: "Complete the payment to activate this plan",
          data: {
            requiresPayment: true,
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            keyId: process.env.RAZORPAY_KEY_ID,
            plan,
            billingInterval,
          },
        })
      } catch (error) {
        console.error("Razorpay plan order creation failed:", error)
        void reportError(error, { where: "POST /api/admin/billing/subscribe", extra: { reason: "Razorpay plan order creation failed" } })
        return NextResponse.json({ success: false, message: "We couldn't start the payment just now. Nothing was charged and your plan is unchanged. Please try again in a minute." }, { status: 502 })
      }
    }

    const { subscription } = await activatePlan({ entityType, entityId, plan, billingInterval })

    const { ipAddress, userAgent } = getClientInfo(request)
    await createAuditLog({
      userId: session.user.id,
      action: "UPDATE",
      entityType: entityType === "enterprise" ? "ENTERPRISE" : "ORGANIZATION",
      entityId,
      description: `Subscribed to ${plan} plan (${billingInterval})`,
      newValues: { plan, billingInterval, price },
      ipAddress,
      userAgent,
    })

    return NextResponse.json({ success: true, data: subscription })
  } catch (error) {
    console.error("Subscribe error:", error)
    return NextResponse.json({ success: false, message: "Failed to subscribe" }, { status: 500 })
  }
}
