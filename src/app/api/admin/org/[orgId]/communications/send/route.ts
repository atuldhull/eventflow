import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"
import { createBulkNotifications } from "@/lib/notifications"
import { emailQueue, replaceMergeTags } from "@/lib/email-queue"
import { createAuditLog, getClientInfo } from "@/lib/audit"
import { z } from "zod/v4"

const sendSchema = z.object({
  eventId: z.string().optional(),
  recipientFilter: z.object({
    type: z.enum(["all", "by_event", "by_status", "custom"]),
    eventId: z.string().optional(),
    statuses: z.array(z.string()).optional(),
    userIds: z.array(z.string()).optional(),
  }),
  subject: z.string().min(1).max(150),
  body: z.string().min(1),
  scheduledFor: z.string().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { orgId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.COMMUNICATION_SEND_EMAIL, { organizationId: orgId })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  try {
    const body = await request.json()
    const parsed = sendSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: "Validation failed" }, { status: 400 })
    }

    const { recipientFilter, subject, body: emailBody } = parsed.data

    // Resolve recipients
    let registrations: { userId: string; user: { name: string; email: string }; registrationNumber: string; event: { title: string } }[]

    const eventId = recipientFilter.eventId || parsed.data.eventId

    if (recipientFilter.type === "custom" && recipientFilter.userIds) {
      registrations = await prisma.registration.findMany({
        where: { userId: { in: recipientFilter.userIds }, event: { organizationId: orgId } },
        select: {
          userId: true,
          registrationNumber: true,
          user: { select: { name: true, email: true } },
          event: { select: { title: true } },
        },
      }) as any
    } else {
      const where: Record<string, unknown> = { event: { organizationId: orgId } }
      if (eventId) where.eventId = eventId
      if (recipientFilter.statuses?.length) where.status = { in: recipientFilter.statuses }

      registrations = await prisma.registration.findMany({
        where: where as any,
        select: {
          userId: true,
          registrationNumber: true,
          user: { select: { name: true, email: true } },
          event: { select: { title: true } },
        },
      }) as any
    }

    // Deduplicate by email
    const seen = new Set<string>()
    const uniqueRecipients = registrations.filter((r) => {
      if (seen.has(r.user.email)) return false
      seen.add(r.user.email)
      return true
    })

    // Queue emails
    const emails = uniqueRecipients.map((r) => ({
      to: r.user.email,
      subject: replaceMergeTags(subject, {
        participant_name: r.user.name,
        event_title: r.event.title,
      }),
      html: replaceMergeTags(emailBody, {
        participant_name: r.user.name,
        participant_email: r.user.email,
        event_title: r.event.title,
        registration_number: r.registrationNumber,
        organizer_name: "Organization",
      }),
    }))

    emailQueue.queueBulkEmails(emails)

    // Create in-app notifications
    const userIds = uniqueRecipients.map((r) => r.userId)
    await createBulkNotifications(userIds, {
      type: "IN_APP",
      category: "UPDATE",
      title: subject,
      message: "You have a new message from the event organizer.",
      eventId: eventId || undefined,
      senderId: session.user.id,
    })

    const { ipAddress, userAgent } = getClientInfo(request)
    await createAuditLog({
      userId: session.user.id,
      action: "CREATE",
      entityType: "ORGANIZATION",
      entityId: orgId,
      description: `Sent email "${subject}" to ${uniqueRecipients.length} recipients`,
      ipAddress,
      userAgent,
      organizationId: orgId,
    })

    return NextResponse.json({
      success: true,
      data: { queued: uniqueRecipients.length, skipped: registrations.length - uniqueRecipients.length },
    })
  } catch (error) {
    console.error("Send communication error:", error)
    return NextResponse.json({ success: false, message: "Failed to send" }, { status: 500 })
  }
}
