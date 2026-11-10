import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { z } from "zod/v4"
import { auth } from "@/lib/auth"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"
import { recipientFilterSchema, resolveRecipients } from "@/lib/org-communications"

const countSchema = z.object({
  eventId: z.string().min(1).max(50).optional(),
  recipientFilter: recipientFilterSchema,
})

/**
 * How many people an email with these recipients would reach (unique addresses), for the
 * confirmation before Send. Same permission and the same recipient query as the send route.
 */
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

  const parsed = countSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || "Choose recipients" }, { status: 400 })
  }

  const { recipientFilter } = parsed.data
  const { recipients } = await resolveRecipients(orgId, recipientFilter, recipientFilter.eventId || parsed.data.eventId)
  return NextResponse.json({ success: true, message: "", data: { count: recipients.length } })
}
