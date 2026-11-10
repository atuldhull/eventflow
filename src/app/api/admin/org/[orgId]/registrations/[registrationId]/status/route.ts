import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { createAuditLog, getClientInfo } from "@/lib/audit"
import { PERMISSIONS } from "@/lib/permissions"
import type { RegistrationStatus } from "@prisma/client"
import {
  CAPACITY_ERRORS,
  CapacityError,
  RELEASE_KEYS,
  addToWaitlist,
  capacityErrorCode,
  claimEventSeat,
  claimTicketStock,
  countsAgainstCapacity,
  couponIsClaimed,
  hasActiveHold,
  reclaimCouponUse,
  registrationMeta,
  releaseEventSeat,
  releaseStockAndCoupon,
  stockIsClaimed,
  ticketQuantity,
  withoutKeys,
  type CapacityErrorCode,
} from "@/lib/registration-capacity"
import { releaseSeatHoldInTx } from "@/lib/seat-hold"
import { issueFreeTicket } from "@/lib/registration-ticket"
import { ensureTicketForRegistration } from "@/lib/payment-completion"
import { issueTicketViewLink } from "@/lib/ticket-view-token"
import { sendEmail } from "@/lib/email"
import { escapeHtml } from "@/lib/escape-html"
import { z } from "zod/v4"

const statusSchema = z.object({
  status: z.enum(["CONFIRMED", "REJECTED", "CANCELLED", "WAITLISTED"]),
  reason: z.string().trim().max(500).optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; registrationId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { orgId, registrationId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.REGISTRATION_APPROVE, { organizationId: orgId })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  const parsed = statusSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "Invalid status" }, { status: 400 })
  }
  const { status } = parsed.data
  const reason = parsed.data.reason || undefined

  const registration = await prisma.registration.findFirst({
    where: { id: registrationId, event: { organizationId: orgId } },
    select: { id: true, status: true, userId: true, eventId: true, registrationNumber: true, event: { select: { title: true, slug: true, currentRegistrations: true } } },
  })

  if (!registration) {
    return NextResponse.json({ success: false, message: "Registration not found" }, { status: 404 })
  }

  // Status change and capacity bookkeeping in one transaction, guarded on the status we
  // read so two admins acting at once can't count (or release) the same seat twice.
  const adminId = session.user.id
  let outcome: "ok" | "conflict" | CapacityErrorCode
  let paidTicketFor: string | null = null
  let approvedNow = false
  try {
    outcome = await prisma.$transaction(async (tx) => {
      const current = await tx.registration.findUnique({
        where: { id: registrationId },
        select: {
          status: true, metadata: true, eventId: true, ticketTypeId: true, userId: true,
          payment: { select: { status: true, amount: true, couponId: true } },
        },
      })
      if (!current) return "conflict"
      const notes = reason ? { notes: reason } : {}
      const removing = status === "REJECTED" || status === "CANCELLED"

      // A paid registration still holding its seat that is rejected or cancelled: release
      // the hold (seat, ticket stock, coupon use; its open payment is marked FAILED).
      if (removing && hasActiveHold(current)) {
        const released = await releaseSeatHoldInTx(tx, registrationId, status === "REJECTED" ? "rejected" : "cancelled", {
          status,
          data: { ...notes, ...(status === "REJECTED" ? { rejectedBy: adminId, rejectionReason: reason || null } : {}) },
        })
        if (released) return "ok"
        return "conflict" // the payment completed meanwhile; let the admin look again
      }

      const { count } = await tx.registration.updateMany({
        where: { id: registrationId, status: current.status },
        data: {
          status: status as RegistrationStatus,
          ...notes,
          ...(status === "CONFIRMED" && current.status !== "CONFIRMED" ? { approvedAt: new Date(), approvedBy: adminId } : {}),
          ...(status === "REJECTED" && current.status !== "REJECTED" ? { rejectedAt: new Date(), rejectedBy: adminId, rejectionReason: reason || null } : {}),
          ...(status === "CANCELLED" && current.status !== "CANCELLED" ? { cancelledAt: new Date(), cancellationReason: reason || null } : {}),
        },
      })
      if (count === 0) return "conflict"

      const wasCounted = countsAgainstCapacity(current)
      const willCount = status === "CONFIRMED" || status === "WAITLISTED"
      let meta = registrationMeta(current.metadata)
      if (!wasCounted && willCount) {
        // Approval (or re-instating): take a seat only if one is free, never overbook.
        if (status === "CONFIRMED") {
          if (!(await claimEventSeat(tx, current.eventId))) throw new CapacityError("EVENT_FULL")
        } else {
          await addToWaitlist(tx, current.eventId)
        }
        // Ticket stock and coupon use given back by an earlier cancel/release: take them again.
        if (!stockIsClaimed(meta)) {
          const stock = await claimTicketStock(tx, current.ticketTypeId, ticketQuantity(meta))
          if (!stock) throw new CapacityError("TICKETS_SOLD_OUT")
        }
        if (current.payment?.couponId && !couponIsClaimed(meta)) await reclaimCouponUse(tx, current.payment.couponId)
        meta = withoutKeys(meta, RELEASE_KEYS)
        await tx.registration.update({ where: { id: registrationId }, data: { metadata: meta } })
      } else if (removing) {
        if (wasCounted) await releaseEventSeat(tx, current.eventId)
        // Ticket stock and coupon use go back once (flags in metadata), and the ticket is void.
        meta = await releaseStockAndCoupon(tx, current, current.payment?.couponId)
        await tx.registration.update({ where: { id: registrationId }, data: { metadata: meta } })
        await tx.ticket.updateMany({ where: { registrationId }, data: { status: "CANCELLED" } })
      }

      // An approved registration gets its ticket. Free ones exactly as POST
      // /api/registrations issues it; paid ones once the payment has completed.
      if (status === "CONFIRMED" && current.status !== "CONFIRMED") {
        approvedNow = true
        if (!current.payment || Number(current.payment.amount) <= 0) {
          await issueFreeTicket(tx, { registrationId, ticketTypeId: current.ticketTypeId, userId: current.userId, eventId: current.eventId })
        } else if (current.payment.status === "COMPLETED") {
          paidTicketFor = registrationId
        }
      }
      return "ok"
    })
  } catch (error) {
    const code = capacityErrorCode(error)
    if (!code) throw error
    outcome = code
  }
  if (outcome === "ok" && paidTicketFor) await ensureTicketForRegistration(paidTicketFor)

  if (outcome === "conflict") {
    return NextResponse.json({ success: false, message: "This registration was changed by someone else. Refresh and try again." }, { status: 409 })
  }
  if (outcome !== "ok") {
    return NextResponse.json({ success: false, message: CAPACITY_ERRORS[outcome].message }, { status: CAPACITY_ERRORS[outcome].status })
  }

  // A guest (no password, no social sign-in) can't open /dashboard/tickets. Once approved
  // they get the same view-only ticket link the free guest flow sends (POST
  // /api/registrations). Only the token's hash is stored, so the link goes out by email only.
  let guestTicket: { email: string; link: string } | null = null
  if (approvedNow) {
    try {
      const [registrant, ticket] = await Promise.all([
        prisma.user.findUnique({
          where: { id: registration.userId },
          select: { email: true, passwordHash: true, _count: { select: { accounts: true } } },
        }),
        prisma.ticket.findUnique({ where: { registrationId }, select: { id: true, status: true, metadata: true } }),
      ])
      if (registrant && !registrant.passwordHash && registrant._count.accounts === 0 && ticket?.status === "ACTIVE") {
        guestTicket = { email: registrant.email, link: await issueTicketViewLink(prisma, ticket, registration.event.slug) }
      }
    } catch (err) {
      console.error("Guest ticket link on approval failed:", err)
    }
  }

  // Create notification for the user
  await prisma.notification.create({
    data: {
      userId: registration.userId,
      type: "IN_APP",
      category: "REGISTRATION",
      title: status === "CONFIRMED" ? "Registration Approved" : status === "REJECTED" ? "Registration Rejected" : `Registration ${status}`,
      message: status === "CONFIRMED"
        ? `Your registration for "${registration.event.title}" has been approved!`
        : status === "REJECTED"
        ? `Your registration for "${registration.event.title}" was rejected.${reason ? ` Reason: ${reason}` : ""}`
        : `Your registration status for "${registration.event.title}" has been updated to ${status}.`,
    },
  })

  if (guestTicket) {
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/+$/, "")
    const subject = `Registration Approved — ${registration.event.title}`
    try {
      await sendEmail({
        to: guestTicket.email,
        subject,
        html: `<h2>${escapeHtml(subject)}</h2><p>Registration #: ${escapeHtml(registration.registrationNumber)}</p><p>Event: ${escapeHtml(registration.event.title)}</p>` +
          `<p>Your registration has been approved. <a href="${escapeHtml(appUrl + guestTicket.link)}">View your ticket</a> (QR code and PDF). Keep this link private.</p>` +
          `<p>To see all your tickets, <a href="${escapeHtml(appUrl + "/forgot-password")}">set a password</a> for ${escapeHtml(guestTicket.email)}.</p>`,
      })
    } catch (err) {
      console.error("Approval email to guest failed:", err)
    }
  }

  const { ipAddress, userAgent } = getClientInfo(request)
  await createAuditLog({
    userId: session.user.id,
    action: "UPDATE",
    entityType: "REGISTRATION",
    entityId: registrationId,
    description: `${status} registration for ${registration.event.title}${reason ? `: ${reason}` : ""}`,
    ipAddress, userAgent, organizationId: orgId,
  })

  return NextResponse.json({ success: true, message: `Registration ${status.toLowerCase()}` })
}
