import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { authorize } from "@/lib/authorization"
import { getClientInfo } from "@/lib/audit"
import { PERMISSIONS } from "@/lib/permissions"
import { bulkApprovalSchema, decideEventApproval } from "@/lib/enterprise-event-approval"

/**
 * Approve several pending events at once (up to 50). Each one goes through the same
 * scoped, status-checked approval as the single route: events that aren't this
 * enterprise's or aren't pending any more are skipped, and paid events that can't be
 * published (payments off or not configured) are reported with the reason.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })

  const { enterpriseId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.EVENT_PUBLISH, { enterpriseId })
  if (!authResult.authorized) return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })

  const parsed = bulkApprovalSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message ?? "Validation failed" }, { status: 400 })
  }

  const { ipAddress, userAgent } = getClientInfo(request)
  const approved: string[] = []
  const skipped: string[] = []
  const blocked: { eventId: string; message: string }[] = []
  for (const eventId of Array.from(new Set(parsed.data.eventIds))) {
    const result = await decideEventApproval({
      enterpriseId,
      eventId,
      action: "approve",
      actor: { id: session.user.id, name: session.user.name },
      ipAddress,
      userAgent,
    })
    if (result.ok) approved.push(eventId)
    else if (result.status === 409) blocked.push({ eventId, message: result.message })
    else skipped.push(eventId)
  }

  const parts = [
    approved.length > 0 && `${approved.length} event${approved.length === 1 ? "" : "s"} approved`,
    blocked.length > 0 && `${blocked.length} can't be published: ${blocked[0].message}`,
    skipped.length > 0 && `${skipped.length} skipped (no longer pending)`,
  ].filter(Boolean)

  return NextResponse.json(
    {
      success: approved.length > 0,
      message: parts.join(". ") || "None of these events is waiting for approval any more.",
      data: { approved, skipped, blocked },
    },
    { status: approved.length > 0 ? 200 : 409 }
  )
}
