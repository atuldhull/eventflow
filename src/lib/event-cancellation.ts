import prisma from "@/lib/prisma"
import { createBulkNotifications } from "@/lib/notifications"
import { emailQueue } from "@/lib/email-queue"
import { escapeHtml, textToHtml } from "@/lib/escape-html"

/** Registrations that still expect to attend: the people told about a cancellation. */
export const ACTIVE_REGISTRATION_STATUSES = ["PENDING", "CONFIRMED", "WAITLISTED", "CHECKED_IN"] as const

export type CancellationRecipient = { userId: string; user: { name: string | null; email: string } }

/** The event's active registrants, one entry per person. Read before the registrations are cancelled. */
export async function activeRegistrants(eventId: string): Promise<CancellationRecipient[]> {
  const registrations = await prisma.registration.findMany({
    where: { eventId, status: { in: [...ACTIVE_REGISTRATION_STATUSES] } },
    select: { userId: true, user: { select: { name: true, email: true } } },
  })
  return [...new Map(registrations.map((r) => [r.userId, r])).values()]
}

/**
 * Tells every active registrant that the event was cancelled, with the organizer's reason:
 * an in-app notification and an email through the shared email queue. The caller makes
 * sure this runs once per cancellation (it only calls it after winning the cancel).
 * Returns how many people were told.
 */
export async function notifyEventCancelled(params: {
  event: { id: string; title: string }
  reason: string
  organizerName: string
  senderId: string
  recipients: CancellationRecipient[]
  /** Every paid ticket was refunded automatically (buyers also get a "Refund processed" email). */
  refundsIssued?: boolean
}): Promise<number> {
  const { event, reason, organizerName, senderId, recipients } = params
  const refundLine = params.refundsIssued
    ? "If you paid for a ticket, it has been refunded to your original payment method. You'll get a separate email about it."
    : "If you paid for a ticket, the organizer will refund you. Contact them if you have questions."
  if (recipients.length === 0) return 0

  await createBulkNotifications(
    recipients.map((r) => r.userId),
    {
      type: "IN_APP",
      category: "UPDATE",
      title: "Event cancelled",
      message: `${event.title} has been cancelled. Reason: ${reason}`,
      data: { actionUrl: "/dashboard/tickets" },
      eventId: event.id,
      senderId,
    }
  )

  emailQueue.queueBulkEmails(
    recipients
      .filter((r) => !!r.user.email)
      .map((r) => ({
        to: r.user.email,
        subject: `Cancelled: ${event.title}`.replace(/[\r\n]+/g, " "),
        html: `
          <p>Hi ${escapeHtml(r.user.name || "there")},</p>
          <p>${escapeHtml(organizerName)} has cancelled <strong>${escapeHtml(event.title)}</strong>, so your registration is cancelled too.</p>
          <p><strong>Reason given:</strong></p>
          <div>${textToHtml(reason)}</div>
          <p>${escapeHtml(refundLine)}</p>
        `,
        text: `Hi ${r.user.name || "there"},\n\n${organizerName} has cancelled ${event.title}, so your registration is cancelled too.\n\nReason given: ${reason}\n\n${refundLine}`,
      }))
  )

  return recipients.length
}
