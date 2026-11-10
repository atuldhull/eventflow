import prisma from "@/lib/prisma"
import { createBulkNotifications } from "@/lib/notifications"
import { emailQueue } from "@/lib/email-queue"
import { escapeHtml, textToHtml } from "@/lib/escape-html"

/**
 * Tells an event's confirmed participants about a published announcement: an in-app
 * notification for each, and an email too when asked. Returns how many were reached.
 */
export async function deliverAnnouncement(params: {
  announcement: { title: string; content: string; eventId: string }
  eventTitle: string
  organizerName: string
  senderId: string
  sendAsEmail: boolean
}): Promise<number> {
  const { announcement, eventTitle, organizerName, senderId, sendAsEmail } = params

  const registrations = await prisma.registration.findMany({
    where: { eventId: announcement.eventId, status: { in: ["CONFIRMED", "CHECKED_IN"] } },
    select: { userId: true, user: { select: { name: true, email: true } } },
  })
  // one message per person, even with several registrations
  const recipients = [...new Map(registrations.map((r) => [r.userId, r])).values()]
  if (recipients.length === 0) return 0

  await createBulkNotifications(
    recipients.map((r) => r.userId),
    {
      type: "IN_APP",
      category: "ANNOUNCEMENT",
      title: announcement.title,
      message: `New update for ${eventTitle}`,
      eventId: announcement.eventId,
      senderId,
    }
  )

  if (sendAsEmail) {
    emailQueue.queueBulkEmails(
      recipients.map((r) => ({
        to: r.user.email,
        subject: `${eventTitle}: ${announcement.title}`.replace(/[\r\n]+/g, " "),
        html: `
          <p>Hi ${escapeHtml(r.user.name)},</p>
          <p>${escapeHtml(organizerName)} posted an update for <strong>${escapeHtml(eventTitle)}</strong>.</p>
          <h3>${escapeHtml(announcement.title)}</h3>
          <div>${textToHtml(announcement.content)}</div>
        `,
      }))
    )
  }

  return recipients.length
}
