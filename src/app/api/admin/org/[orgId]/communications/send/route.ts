import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"
import { createBulkNotifications } from "@/lib/notifications"
import { emailQueue, replaceMergeTags } from "@/lib/email-queue"
import { createAuditLog, getClientInfo } from "@/lib/audit"
import { escapeHtml, textToHtml } from "@/lib/escape-html"
import { COMMUNICATION_ENTITY, deleteDraft, recipientFilterSchema, resolveRecipients } from "@/lib/org-communications"
import { z } from "zod/v4"

const sendSchema = z.object({
  eventId: z.string().min(1).max(50).optional(),
  recipientFilter: recipientFilterSchema,
  subject: z.string().trim().min(1).max(150),
  body: z.string().trim().min(1).max(20_000),
  /** "text": what was typed in the composer (escaped, line breaks kept); "html": sent as written */
  format: z.enum(["text", "html"]).default("text"),
  /** the draft this message was composed from; it is deleted once the message is sent */
  draftId: z.string().max(60).optional(),
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
    const parsed = sendSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || "Validation failed" },
        { status: 400 }
      )
    }

    const { recipientFilter, subject, body: rawBody, format, draftId } = parsed.data
    const eventId = recipientFilter.eventId || parsed.data.eventId

    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } })
    if (!org) return NextResponse.json({ success: false, message: "Organization not found" }, { status: 404 })

    // Scoped to this organization's events and deduplicated by email (the same list the
    // recipient count before sending uses).
    const { registrations: registrationCount, recipients: uniqueRecipients } = await resolveRecipients(orgId, recipientFilter, eventId)

    if (uniqueRecipients.length === 0) {
      return NextResponse.json({ success: false, message: "No participants match these recipients" }, { status: 400 })
    }

    const html = format === "text" ? `<div>${textToHtml(rawBody)}</div>` : rawBody

    // Queue emails. Merge values come from participants, so they are escaped in the HTML.
    const emails = uniqueRecipients.map((r) => {
      const values = {
        participant_name: r.user.name,
        participant_email: r.user.email,
        event_title: r.event.title,
        registration_number: r.registrationNumber,
        organizer_name: org.name,
      }
      return {
        to: r.user.email,
        subject: replaceMergeTags(subject, values).replace(/[\r\n]+/g, " "),
        html: replaceMergeTags(html, Object.fromEntries(Object.entries(values).map(([k, v]) => [k, escapeHtml(v)]))),
      }
    })

    emailQueue.queueBulkEmails(emails)

    // Create in-app notifications
    await createBulkNotifications(uniqueRecipients.map((r) => r.userId), {
      type: "IN_APP",
      category: "UPDATE",
      // one notification text for everyone: personal merge tags are left out
      title: replaceMergeTags(subject, { organizer_name: org.name }).replace(/\{\{\w+\}\}/g, "").replace(/\s+/g, " ").trim() || org.name,
      message: `You have a new message from ${org.name}.`,
      eventId: eventId || undefined,
      senderId: session.user.id,
    })

    if (draftId) await deleteDraft(orgId, draftId)

    const audience =
      recipientFilter.type === "by_event" ? "One event"
        : recipientFilter.type === "by_status" ? `Status: ${(recipientFilter.statuses ?? []).join(", ")}`
        : recipientFilter.type === "custom" ? "Selected people"
        : "All participants"

    const { ipAddress, userAgent } = getClientInfo(request)
    await createAuditLog({
      userId: session.user.id,
      action: "CREATE",
      entityType: COMMUNICATION_ENTITY,
      entityId: orgId,
      description: `Sent email "${subject}" to ${uniqueRecipients.length} recipients`,
      newValues: { subject, recipients: uniqueRecipients.length, audience, eventId: eventId ?? null },
      eventId: eventId || undefined,
      ipAddress,
      userAgent,
      organizationId: orgId,
    })

    return NextResponse.json({
      success: true,
      message: `Email queued for ${uniqueRecipients.length} recipient${uniqueRecipients.length === 1 ? "" : "s"}`,
      data: { queued: uniqueRecipients.length, skipped: registrationCount - uniqueRecipients.length },
    })
  } catch (error) {
    console.error("Send communication error:", error)
    return NextResponse.json({ success: false, message: "Failed to send" }, { status: 500 })
  }
}
