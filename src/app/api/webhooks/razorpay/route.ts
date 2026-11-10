import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import prisma from "@/lib/prisma"
import { verifyWebhookSignature } from "@/lib/razorpay-signature"
import { completeRegistrationPayment } from "@/lib/payment-completion"
import { releaseSeatHold } from "@/lib/seat-hold"
import { applyFullRefundEffects, registrationMeta } from "@/lib/registration-capacity"
import { activatePlan, getPlanAmount, PLAN_ORDER_PURPOSE, type BillingEntityType, type BillingInterval } from "@/lib/billing"
import { getOrderNotes, getRazorpay, isRazorpayConfigured, type RazorpayOrder } from "@/lib/razorpay"
import type { PlanName } from "@/lib/subscription"
import { notify, notifySafely } from "@/lib/notifications"
import { sendEmail } from "@/lib/email"
import { escapeHtml } from "@/lib/escape-html"

// Razorpay server-to-server events. Authenticated only by the HMAC signature over the
// raw body, so this route must stay reachable without a session.

type PaymentEntity = {
  id: string
  order_id?: string | null
  amount?: number
  amount_refunded?: number
  currency?: string
  error_description?: string | null
  error_reason?: string | null
}

type RefundEntity = {
  id: string
  payment_id: string
  amount?: number
}

type RazorpayWebhookEvent = {
  event?: string
  payload?: {
    payment?: { entity?: PaymentEntity }
    order?: { entity?: RazorpayOrder }
    refund?: { entity?: RefundEntity }
  }
}

const toPaise = (amount: unknown) => Math.round(Number(amount ?? 0) * 100)

const PAID_PLANS: readonly string[] = ["STARTER", "PRO", "ENTERPRISE"]
const INTERVALS: readonly string[] = ["MONTHLY", "YEARLY"]
const ENTITY_TYPES: readonly string[] = ["org", "enterprise"]

async function handlePaymentCaptured(entity: PaymentEntity | undefined, orderEntity: RazorpayOrder | undefined) {
  if (!entity?.id || !entity.order_id) return

  const payment = await prisma.payment.findFirst({
    where: { gatewayOrderId: entity.order_id },
    select: { id: true, amount: true, status: true },
  })
  // No Payment row: an order replaced when its registration was reused, or not a
  // registration payment at all (it may be a plan purchase).
  if (!payment) {
    if (await flagSupersededCapture(entity)) return
    await activatePlanFromWebhook(entity, orderEntity)
    return
  }
  if (payment.status === "COMPLETED") return

  if (typeof entity.amount === "number" && entity.amount !== toPaise(payment.amount)) {
    console.error(`Razorpay webhook: amount mismatch for payment ${payment.id} (gateway ${entity.amount}, expected ${toPaise(payment.amount)})`)
    return
  }

  // Uses the registration's seat hold, or re-claims the seat if the hold was released.
  await completeRegistrationPayment(payment.id, { gatewayPaymentId: entity.id })
}

// A capture on a gateway order that a re-registration replaced (registration-capacity.ts
// resetPaymentForReuse): the money arrived for an attempt that no longer exists, so it is
// recorded on the payment and flagged for the organizer to refund.
async function flagSupersededCapture(entity: PaymentEntity): Promise<boolean> {
  const payment = await prisma.payment.findFirst({
    where: { metadata: { path: ["previousOrderIds"], array_contains: [entity.order_id!] } },
    select: { id: true, metadata: true },
  })
  if (!payment) return false
  const meta = registrationMeta(payment.metadata)
  const captures = Array.isArray(meta.supersededCaptures) ? meta.supersededCaptures : []
  if (captures.some((c) => (c as { paymentId?: string } | null)?.paymentId === entity.id)) return true
  console.error(`Razorpay webhook: payment ${entity.id} captured on superseded order ${entity.order_id}; flagged for refund on payment ${payment.id}`)
  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      metadata: {
        ...meta,
        refundRequired: true,
        supersededCaptures: [...captures, { orderId: entity.order_id!, paymentId: entity.id, amount: entity.amount ?? null, capturedAt: new Date().toISOString() }],
      },
    },
  })
  return true
}

// Plan purchases opened by /api/admin/billing/subscribe are normally activated by
// /api/admin/billing/verify; this covers buyers who close the tab before it runs. Same
// checks and the same idempotent activatePlan (keyed on the order id) as verify.
async function activatePlanFromWebhook(entity: PaymentEntity, orderEntity: RazorpayOrder | undefined) {
  const orderId = entity.order_id!
  let order = orderEntity?.id === orderId ? orderEntity : undefined
  if (!order) {
    if (!isRazorpayConfigured()) {
      console.warn(`Razorpay webhook: can't look up order ${orderId} (Razorpay keys not configured)`)
      return
    }
    // Throws on network errors: the 500 makes Razorpay redeliver.
    order = await getRazorpay().orders.fetch(orderId)
  }

  const notes = getOrderNotes(order)
  if (notes.purpose !== PLAN_ORDER_PURPOSE) return // not ours to handle

  const { entityType, entityId, plan, billingInterval, userId } = notes
  if (!ENTITY_TYPES.includes(entityType) || !entityId || !PAID_PLANS.includes(plan) || !INTERVALS.includes(billingInterval)) {
    console.error(`Razorpay webhook: plan order ${orderId} has invalid notes`, notes)
    return
  }

  const price = getPlanAmount(plan as PlanName, billingInterval as BillingInterval)
  const expectedPaise = Math.round(price * 100)
  const paidPaise = typeof entity.amount === "number" ? entity.amount : Number(order.amount)
  if (price <= 0 || order.currency !== "INR" || Number(order.amount) !== expectedPaise || paidPaise !== expectedPaise) {
    console.error(`Razorpay webhook: plan order ${orderId} amount does not match the ${plan} ${billingInterval} price`)
    return
  }

  // Audited inside activatePlan's transaction, so only the call that actually activates
  // (this one or /verify, whichever runs first) writes the entry. The buyer recorded in
  // the order notes is the actor, if that user still exists.
  const buyer = userId ? await prisma.user.findUnique({ where: { id: userId }, select: { id: true } }) : null
  await activatePlan({
    entityType: entityType as BillingEntityType,
    entityId,
    plan: plan as PlanName,
    billingInterval: billingInterval as BillingInterval,
    payment: { orderId, paymentId: entity.id },
    ...(buyer
      ? {
          audit: {
            userId: buyer.id,
            description: `Subscribed to ${plan} plan (${billingInterval}) — confirmed by payment webhook`,
            newValues: { plan, billingInterval, price, gatewayOrderId: orderId, gatewayPaymentId: entity.id },
          },
        }
      : {}),
  })
}

async function handlePaymentFailed(entity: PaymentEntity | undefined) {
  if (!entity?.order_id) return

  // Only moves still-open payments; never downgrades a COMPLETED/REFUNDED row.
  await prisma.payment.updateMany({
    where: { gatewayOrderId: entity.order_id, status: { in: ["PENDING", "PROCESSING"] } },
    data: {
      status: "FAILED",
      failedAt: new Date(),
      failureReason: entity.error_description || entity.error_reason || "Payment failed",
    },
  })

  // Give the held seat back. The buyer can retry: create-order re-holds a seat if one is
  // free, and a payment that still goes through re-claims it.
  const payment = await prisma.payment.findFirst({
    where: { gatewayOrderId: entity.order_id },
    select: { registrationId: true },
  })
  if (payment?.registrationId) await releaseSeatHold(payment.registrationId, "payment_failed")
}

async function handleRefundProcessed(refund: RefundEntity | undefined, paymentEntity: PaymentEntity | undefined) {
  if (!refund?.id || !refund.payment_id) return

  const payment = await prisma.payment.findFirst({
    where: { gatewayPaymentId: refund.payment_id },
    select: {
      id: true, amount: true, status: true, refundId: true, refundAmount: true, registrationId: true, couponId: true,
      userId: true, eventId: true, currency: true, user: { select: { email: true } }, event: { select: { title: true } },
    },
  })
  // Unknown payment, already recorded, or already refunded in-app (which also cancelled the registration).
  if (!payment || payment.refundId === refund.id) return
  if (payment.status !== "COMPLETED" && payment.status !== "PARTIALLY_REFUNDED") return

  const totalRefundedPaise = typeof paymentEntity?.amount_refunded === "number"
    ? paymentEntity.amount_refunded
    : toPaise(payment.refundAmount) + (refund.amount ?? 0)
  const totalRefunded = totalRefundedPaise / 100
  const fullRefund = totalRefundedPaise >= toPaise(payment.amount)

  const applied = await prisma.$transaction(async (tx) => {
    const { count } = await tx.payment.updateMany({
      where: {
        id: payment.id,
        status: { in: ["COMPLETED", "PARTIALLY_REFUNDED"] },
        AND: [
          { OR: [{ refundId: null }, { refundId: { not: refund.id } }] },
          // Monotonic: an older refund event delivered late can't shrink the refunded total.
          { OR: [{ refundAmount: null }, { refundAmount: { lt: totalRefunded } }] },
        ],
      },
      data: {
        status: fullRefund ? "REFUNDED" : "PARTIALLY_REFUNDED",
        refundId: refund.id,
        refundAmount: totalRefunded,
        refundedAt: new Date(),
      },
    })

    // A full refund from the Razorpay dashboard has the same effect as the in-app refund
    // route: registration and ticket cancelled, seat and coupon use returned. The guarded
    // update above moves a payment to REFUNDED once, so this runs once. Partial refunds
    // only record the amount.
    if (count === 1 && fullRefund && payment.registrationId) {
      await applyFullRefundEffects(tx, {
        registrationId: payment.registrationId,
        couponId: payment.couponId,
        reason: "Payment refunded via Razorpay",
      })
    }
    return count === 1
  })
  if (!applied) return

  // Tell the buyer (once: only the delivery that moved the payment gets here). Their
  // registration may just have been cancelled, so silence would look like a bug.
  const refundedNow = (refund.amount ?? totalRefundedPaise - toPaise(payment.refundAmount)) / 100
  const eventTitle = payment.event?.title ?? "your event"
  await notifySafely(() => notify.paymentRefunded(payment.userId, payment.eventId, refundedNow, eventTitle, fullRefund))
  if (payment.user?.email) {
    const amount = new Intl.NumberFormat("en-IN", { style: "currency", currency: payment.currency || "INR" }).format(refundedNow)
    await sendEmail({
      to: payment.user.email,
      subject: `Refund processed — ${eventTitle}`,
      html: `<h2>Refund processed</h2><p>${escapeHtml(amount)} for ${escapeHtml(eventTitle)} has been refunded to your original payment method. ` +
        `Banks usually take 5–7 working days to show it.</p>` +
        (fullRefund ? `<p>Your registration has been cancelled and your ticket is no longer valid.</p>` : ""),
    }).catch((err) => console.error("Refund email failed:", err))
  }
}

export async function POST(request: NextRequest) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json({ success: false, message: "Webhooks are not configured" }, { status: 503 })
  }

  // Signature is over the exact bytes received, so read the raw body before parsing.
  const rawBody = await request.text()
  const signature = request.headers.get("x-razorpay-signature")
  if (!verifyWebhookSignature({ rawBody, signature, secret })) {
    return NextResponse.json({ success: false, message: "Invalid signature" }, { status: 400 })
  }

  let event: RazorpayWebhookEvent
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ success: false, message: "Invalid payload" }, { status: 400 })
  }

  try {
    const payment = event.payload?.payment?.entity
    switch (event.event) {
      case "payment.captured":
      case "order.paid":
        await handlePaymentCaptured(payment, event.payload?.order?.entity)
        break
      case "payment.failed":
        await handlePaymentFailed(payment)
        break
      case "refund.processed":
        await handleRefundProcessed(event.payload?.refund?.entity, payment)
        break
      default:
        // Acknowledge events we don't act on so Razorpay doesn't retry them.
        break
    }
    return NextResponse.json({ success: true, message: "OK" })
  } catch (error) {
    // Non-2xx makes Razorpay retry; every handler above is idempotent.
    console.error(`Razorpay webhook ${event.event} failed:`, error)
    return NextResponse.json({ success: false, message: "Webhook processing failed" }, { status: 500 })
  }
}
