import type { Prisma } from "@prisma/client"
import prisma from "@/lib/prisma"
import { generateTicket } from "@/lib/ticket"
import { notify, notifySafely } from "@/lib/notifications"
import { sendEmail } from "@/lib/email"
import { escapeHtml } from "@/lib/escape-html"
import {
  COUPON_RELEASED,
  HOLD_KEYS,
  STOCK_RELEASED,
  addToWaitlist,
  claimEventSeat,
  claimTicketStock,
  couponIsClaimed,
  hasActiveHold,
  holdIsReclaimable,
  reclaimCouponUse,
  registrationMeta,
  releaseEventSeat,
  stockIsClaimed,
  ticketQuantity,
  withoutKeys,
} from "@/lib/registration-capacity"

type Tx = Prisma.TransactionClient

// Statuses a registration payment may move to COMPLETED from. FAILED is included
// because Razorpay lets the buyer retry on the same order after a failed attempt, and
// because a payment can still be captured after its seat hold expired.
const COMPLETABLE_STATUSES = ["PENDING", "PROCESSING", "FAILED"] as const

export type PaymentCompletion = {
  // false when another caller (verify vs webhook vs reconciliation) completed it first
  completed: boolean
  registrationId?: string
  registrationStatus?: string
  // The money was taken but no seat could be given: an organizer has to refund it.
  refundRequired?: boolean
}

// Marks a registration payment COMPLETED and settles its registration. The
// status-guarded updateMany makes this safe to call from the verify route, the Razorpay
// webhook and reconciliation: only the first caller performs the side effects.
export async function completeRegistrationPayment(
  paymentId: string,
  gateway: { gatewayPaymentId: string; gatewaySignature?: string | null }
): Promise<PaymentCompletion> {
  const outcome = await prisma.$transaction(async (tx) => {
    // Payment row first: the same lock order as a seat-hold release (seat-hold.ts).
    const { count } = await tx.payment.updateMany({
      where: { id: paymentId, status: { in: [...COMPLETABLE_STATUSES] } },
      data: {
        status: "COMPLETED",
        gatewayPaymentId: gateway.gatewayPaymentId,
        ...(gateway.gatewaySignature ? { gatewaySignature: gateway.gatewaySignature } : {}),
        paidAt: new Date(),
        failedAt: null,
        failureReason: null,
      },
    })
    if (count === 0) return null

    const payment = await tx.payment.findUniqueOrThrow({
      where: { id: paymentId },
      select: { registrationId: true, couponId: true },
    })
    return settleRegistration(tx, payment.registrationId, payment.couponId)
  })

  if (!outcome) return { completed: false }

  // Only the caller that completed the payment gets here, so the buyer is told once.
  await notifySafely(async () => {
    const paid = await prisma.payment.findUnique({
      where: { id: paymentId },
      select: { userId: true, eventId: true, amount: true, event: { select: { title: true } } },
    })
    if (paid) await notify.paymentConfirmed(paid.userId, paid.eventId, Number(paid.amount), paid.event.title)
  })

  if (outcome.refundRequired) {
    console.warn(`Payment ${paymentId} completed without a seat; registration ${outcome.registrationId} is ${outcome.registrationStatus} and flagged refundRequired`)
  }

  // Generate ticket (unique number + valid dates + signed QR). Payment already succeeded,
  // so a failure here is logged and recovered by the next verify call.
  if (outcome.registrationStatus === "CONFIRMED") {
    await ensureTicketForRegistration(outcome.registrationId)
  }
  await sendPaymentReceivedEmail(paymentId, outcome)
  return { completed: true, ...outcome }
}

// The buyer's receipt. Registration only sent "Registration Received" (payment pending), so
// without this a paying buyer never got an email saying the money arrived. Never throws:
// the payment is already complete.
async function sendPaymentReceivedEmail(paymentId: string, outcome: Settled): Promise<void> {
  try {
    const paid = await prisma.payment.findUnique({
      where: { id: paymentId },
      select: {
        amount: true, currency: true, paymentNumber: true, paidAt: true,
        user: { select: { email: true, name: true } },
        event: { select: { title: true } },
        registration: { select: { registrationNumber: true, ticket: { select: { ticketNumber: true } } } },
      },
    })
    if (!paid?.user?.email) return
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/+$/, "")
    const amount = new Intl.NumberFormat("en-IN", { style: "currency", currency: paid.currency || "INR" }).format(Number(paid.amount))
    const title = escapeHtml(paid.event.title)
    const confirmed = outcome.registrationStatus === "CONFIRMED" && !outcome.refundRequired
    const subject = confirmed ? `Payment received — you're going to ${paid.event.title}` : `Payment received — ${paid.event.title}`
    const rows = [
      ["Amount paid", escapeHtml(amount)],
      ["Payment #", escapeHtml(paid.paymentNumber)],
      ["Registration #", escapeHtml(paid.registration?.registrationNumber ?? "")],
      ...(confirmed && paid.registration?.ticket ? [["Ticket #", escapeHtml(paid.registration.ticket.ticketNumber)]] : []),
    ]
    const status = confirmed
      ? `<p>Your seat is confirmed. <a href="${escapeHtml(appUrl + "/dashboard/tickets")}">Open your ticket</a> (QR code and PDF) to show at the entrance.</p>`
      : outcome.refundRequired
        ? `<p>We received your payment, but the last seat was taken before it arrived. The organizer has been asked to refund you; you don't need to do anything.</p>`
        : `<p>You're on the waitlist. The organizer will confirm your seat if one opens up.</p>`
    await sendEmail({
      to: paid.user.email,
      subject,
      html: `<h2>Payment received</h2><p>Event: ${title}</p>` +
        `<table cellpadding="4">${rows.map(([k, v]) => `<tr><td>${k}</td><td><strong>${v}</strong></td></tr>`).join("")}</table>` +
        status +
        `<p><a href="${escapeHtml(appUrl + "/dashboard/payments")}">See your payments and invoices</a></p>`,
    })
  } catch (err) {
    console.error("Payment receipt email failed:", err)
  }
}

type Settled = { registrationId: string; registrationStatus: string; refundRequired: boolean }

async function settleRegistration(tx: Tx, registrationId: string, couponId: string | null): Promise<Settled> {
  const reg = await tx.registration.findUniqueOrThrow({
    where: { id: registrationId },
    select: { id: true, status: true, metadata: true, eventId: true, ticketTypeId: true },
  })
  let meta = registrationMeta(reg.metadata)
  const now = new Date().toISOString()

  const confirm = async (nextMeta: Prisma.JsonObject, extra: Prisma.RegistrationUpdateInput = {}): Promise<Settled> => {
    await tx.registration.update({
      where: { id: reg.id },
      data: { status: "CONFIRMED", ...extra, metadata: { ...nextMeta, paidAt: now } },
    })
    return { registrationId: reg.id, registrationStatus: "CONFIRMED", refundRequired: false }
  }

  // Keep the payment, give no seat: waitlisted (counted like any waitlisted
  // registration) and flagged so organizers can refund.
  const waitlistForRefund = async (nextMeta: Prisma.JsonObject): Promise<Settled> => {
    const waitlistPosition = await addToWaitlist(tx, reg.eventId)
    await tx.registration.update({
      where: { id: reg.id },
      data: {
        status: "WAITLISTED",
        waitlistPosition,
        cancelledAt: null,
        cancellationReason: null,
        metadata: { ...nextMeta, refundRequired: true, refundRequiredReason: "Paid after the seat hold was released and the event was full", refundFlaggedAt: now },
      },
    })
    return { registrationId: reg.id, registrationStatus: "WAITLISTED", refundRequired: true }
  }

  // Keep the registration as it is (an organizer cancelled or rejected it, or it is
  // waitlisted) and flag the payment for a refund.
  const flagForRefund = async (reason: string): Promise<Settled> => {
    await tx.registration.update({
      where: { id: reg.id },
      data: { metadata: { ...meta, refundRequired: true, refundRequiredReason: reason, refundFlaggedAt: now } },
    })
    return { registrationId: reg.id, registrationStatus: reg.status, refundRequired: true }
  }

  // 1. Paid within the hold: seat, stock and coupon were claimed at registration.
  if (hasActiveHold(reg)) return confirm(withoutKeys(meta, HOLD_KEYS))

  // A coupon use given back (hold released, registration cancelled): the discounted
  // payment went through after all, so take it again; a later refund returns it.
  if (couponId && !couponIsClaimed(meta)) {
    await reclaimCouponUse(tx, couponId)
    meta = withoutKeys(meta, [COUPON_RELEASED])
  }

  // 2. The hold expired or its payment failed and the seat was released: re-claim seat
  //    and ticket stock if there is still room, otherwise waitlist and flag for refund.
  if (holdIsReclaimable(reg)) {
    if (await claimEventSeat(tx, reg.eventId)) {
      if (stockIsClaimed(meta) || await claimTicketStock(tx, reg.ticketTypeId, ticketQuantity(meta))) {
        return confirm(withoutKeys(meta, [...HOLD_KEYS, STOCK_RELEASED]), { cancelledAt: null, cancellationReason: null })
      }
      await releaseEventSeat(tx, reg.eventId)
    }
    // Ticket stock stays given back (stockReleasedAt is kept).
    return waitlistForRefund(withoutKeys(meta, HOLD_KEYS))
  }

  switch (reg.status) {
    case "PENDING":
      // A PENDING registration without a hold predates seat holds (or awaited approval):
      // its ticket stock was claimed at registration but its seat was not.
      return (await claimEventSeat(tx, reg.eventId)) ? confirm(meta) : waitlistForRefund(meta)
    case "CONFIRMED":
    case "CHECKED_IN":
    case "NO_SHOW":
      // Already holds its seat (e.g. an organizer confirmed it before payment).
      if (meta !== registrationMeta(reg.metadata)) {
        await tx.registration.update({ where: { id: reg.id }, data: { metadata: meta } })
      }
      return { registrationId: reg.id, registrationStatus: reg.status, refundRequired: false }
    case "WAITLISTED":
      return flagForRefund("Paid while on the waitlist")
    default:
      // CANCELLED or REJECTED on purpose: don't resurrect it.
      return flagForRefund(`Paid after the registration was ${reg.status.toLowerCase()}`)
  }
}

// Issues the ticket if a confirmed, paid registration doesn't have one yet (e.g. ticket
// generation failed after a successful payment), or re-activates the one cancelled with an
// earlier attempt of a reused registration. Waitlisted or cancelled ones get none.
export async function ensureTicketForRegistration(registrationId: string): Promise<void> {
  const [registration, ticket] = await Promise.all([
    prisma.registration.findUnique({ where: { id: registrationId }, select: { status: true, ticketTypeId: true, userId: true } }),
    prisma.ticket.findFirst({ where: { registrationId }, select: { id: true, status: true } }),
  ])
  if (registration?.status !== "CONFIRMED") return
  // A live ticket stays as it is; a missing or cancelled one is issued (re-activated with a
  // fresh number and signed QR) by the same issuer as free tickets.
  if (ticket && ticket.status !== "CANCELLED") return
  try { await generateTicket(registrationId) } catch (err) { console.error("Ticket generation failed after successful payment:", err) }
}
