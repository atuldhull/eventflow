import prisma from "@/lib/prisma"
import { applyFullRefundEffects } from "@/lib/registration-capacity"
import { getRazorpay, isRazorpayConfigured } from "@/lib/razorpay"
import { notify, notifySafely } from "@/lib/notifications"
import { sendEmail } from "@/lib/email"
import { escapeHtml } from "@/lib/escape-html"
import { createAuditLog } from "@/lib/audit"

/** Payments that still hold money which could be refunded. */
export const REFUNDABLE_STATUSES = ["COMPLETED", "PARTIALLY_REFUNDED"] as const

export type RefundResult =
  | { ok: true; status: 200; message: string; refundAmount: number; full: boolean; viaGateway: boolean }
  | { ok: false; status: number; message: string }

/**
 * Refunds one of an organization's payments: through Razorpay first for online payments (only
 * a refund Razorpay accepted is recorded), recorded only for cash / bank-transfer payments,
 * which the organizer pays back outside EventFlow. A full refund cancels the registration,
 * voids the ticket and gives back the seat, stock and coupon use. The buyer is told in the
 * app and by email. `amount` (rupees) defaults to everything not yet refunded.
 */
export async function refundOrgPayment(params: {
  orgId: string
  paymentId: string
  actorId: string
  amount?: number
  reason?: string
  audit?: { ipAddress?: string; userAgent?: string }
}): Promise<RefundResult> {
  const { orgId, paymentId, actorId, amount, reason, audit } = params

  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, registration: { event: { organizationId: orgId } } },
    select: {
      id: true, amount: true, currency: true, status: true, method: true, gatewayPaymentId: true, refundAmount: true,
      userId: true, eventId: true, registrationId: true, couponId: true,
      user: { select: { email: true } },
      registration: { select: { event: { select: { title: true } } } },
    },
  })

  if (!payment) return { ok: false, status: 404, message: "Payment not found" }
  if (payment.status === "REFUNDED") return { ok: false, status: 400, message: "Already refunded" }
  if (payment.status !== "COMPLETED" && payment.status !== "PARTIALLY_REFUNDED") {
    return { ok: false, status: 400, message: "Can only refund completed payments" }
  }

  const paidPaise = Math.round(Number(payment.amount) * 100)
  const alreadyPaise = Math.round(Number(payment.refundAmount ?? 0) * 100)
  const refundPaise = Math.round((amount ?? (paidPaise - alreadyPaise) / 100) * 100)
  if (refundPaise <= 0 || alreadyPaise + refundPaise > paidPaise) {
    return { ok: false, status: 400, message: "Refund amount exceeds what is left to refund" }
  }
  const refundAmount = refundPaise / 100
  const totalRefunded = (alreadyPaise + refundPaise) / 100
  const fullRefund = alreadyPaise + refundPaise >= paidPaise
  const eventTitle = payment.registration?.event.title ?? "your event"

  let gatewayRefundId: string | null = null
  if (payment.method === "RAZORPAY" && payment.gatewayPaymentId) {
    if (!isRazorpayConfigured()) {
      return { ok: false, status: 503, message: "Payments are not configured, so the refund can't be sent. Refund it from the Razorpay dashboard instead." }
    }
    try {
      const refund = await getRazorpay().payments.refund(payment.gatewayPaymentId, {
        amount: refundPaise,
        notes: { paymentId: payment.id, reason: reason || "Refunded by organizer" },
      })
      gatewayRefundId = refund.id
    } catch (err) {
      console.error("Razorpay refund failed:", err)
      const detail = (err as { error?: { description?: string } })?.error?.description
      return { ok: false, status: 502, message: `Razorpay did not accept the refund${detail ? `: ${detail}` : ""}. Nothing was changed.` }
    }
  }

  // The status-guarded update makes a double submit apply the registration, ticket, seat
  // and coupon effects only once. Storing Razorpay's refund id makes its refund.processed
  // webhook for this same refund a no-op; if that webhook got here first it already
  // recorded everything (and told the buyer), so count is 0 and that's still a success.
  const refunded = await prisma.$transaction(async (tx) => {
    const { count } = await tx.payment.updateMany({
      where: { id: paymentId, status: payment.status, refundAmount: payment.refundAmount },
      data: {
        status: fullRefund ? "REFUNDED" : "PARTIALLY_REFUNDED",
        refundAmount: totalRefunded,
        refundReason: reason || null,
        refundedAt: new Date(),
        ...(gatewayRefundId ? { refundId: gatewayRefundId } : {}),
      },
    })
    if (count === 0) return false
    if (fullRefund && payment.registrationId) {
      await applyFullRefundEffects(tx, { registrationId: payment.registrationId, couponId: payment.couponId, reason: reason || "Payment refunded" })
    }
    return true
  })
  if (!refunded) {
    if (gatewayRefundId) {
      return { ok: true, status: 200, message: `₹${refundAmount} refunded through Razorpay`, refundAmount, full: fullRefund, viaGateway: true }
    }
    return { ok: false, status: 409, message: "This payment was changed meanwhile. Refresh and try again." }
  }

  // Tell the buyer, in the app and by email
  await notifySafely(() => notify.paymentRefunded(payment.userId, payment.eventId, refundAmount, eventTitle, fullRefund))
  if (payment.user?.email) {
    const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: payment.currency || "INR" }).format(refundAmount)
    await sendEmail({
      to: payment.user.email,
      subject: `Refund processed — ${eventTitle}`,
      html: `<h2>Refund processed</h2><p>${escapeHtml(money)} for ${escapeHtml(eventTitle)} has been refunded` +
        (gatewayRefundId ? ` to your original payment method. Banks usually take 5–7 working days to show it.` : ` by the organizer.`) + `</p>` +
        (reason ? `<p>Reason: ${escapeHtml(reason)}</p>` : "") +
        (fullRefund ? `<p>Your registration has been cancelled and your ticket is no longer valid.</p>` : ""),
    }).catch((err) => console.error("Refund email failed:", err))
  }

  await createAuditLog({
    userId: actorId,
    action: "UPDATE",
    entityType: "PAYMENT",
    entityId: paymentId,
    description: `Refunded ₹${refundAmount} for ${eventTitle}`,
    ipAddress: audit?.ipAddress, userAgent: audit?.userAgent, organizationId: orgId,
  })

  return {
    ok: true, status: 200, refundAmount, full: fullRefund, viaGateway: !!gatewayRefundId,
    message: gatewayRefundId ? `₹${refundAmount} refunded to the buyer through Razorpay` : `₹${refundAmount} recorded as refunded`,
  }
}

export type RefundAllSummary = { attempted: number; refunded: number; failed: { paymentId: string; message: string }[]; remaining: number }

/**
 * Refunds every payment of one of the organization's events that still holds money (used
 * when a paid event is cancelled). One at a time, so a Razorpay refusal or missing keys
 * only affects that payment; the rest go on. At most `limit` per call; `remaining` says
 * how many are left for another call (the organizer's "Refund all" button).
 */
export async function refundAllForEvent(params: {
  orgId: string
  eventId: string
  actorId: string
  reason: string
  limit?: number
  audit?: { ipAddress?: string; userAgent?: string }
}): Promise<RefundAllSummary> {
  const { orgId, eventId, actorId, reason, audit } = params
  const limit = params.limit ?? 100
  const payments = await prisma.payment.findMany({
    where: { eventId, status: { in: [...REFUNDABLE_STATUSES] }, registration: { event: { organizationId: orgId } } },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: limit,
  })
  const summary: RefundAllSummary = { attempted: payments.length, refunded: 0, failed: [], remaining: 0 }
  for (const p of payments) {
    const r = await refundOrgPayment({ orgId, paymentId: p.id, actorId, reason, audit })
    if (r.ok) summary.refunded++
    else summary.failed.push({ paymentId: p.id, message: r.message })
  }
  summary.remaining = await prisma.payment.count({
    where: { eventId, status: { in: [...REFUNDABLE_STATUSES] }, registration: { event: { organizationId: orgId } } },
  })
  return summary
}
