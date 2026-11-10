import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { authorize } from "@/lib/authorization"
import { getClientInfo } from "@/lib/audit"
import { PERMISSIONS } from "@/lib/permissions"
import { approvalDecisionSchema, decideEventApproval } from "@/lib/enterprise-event-approval"

/**
 * Approve or reject an event waiting for the enterprise's approval. Rejecting needs a
 * reason: it is stored on the event and sent to its creator and the organization's admins.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string; eventId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })

  const { enterpriseId, eventId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.EVENT_PUBLISH, { enterpriseId })
  if (!authResult.authorized) return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })

  const parsed = approvalDecisionSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message ?? "Validation failed" }, { status: 400 })
  }

  const { ipAddress, userAgent } = getClientInfo(request)
  const result = await decideEventApproval({
    enterpriseId,
    eventId,
    action: parsed.data.action,
    reason: parsed.data.reason,
    actor: { id: session.user.id, name: session.user.name },
    ipAddress,
    userAgent,
  })
  if (!result.ok) return NextResponse.json({ success: false, message: result.message }, { status: result.status })

  return NextResponse.json({
    success: true,
    message: result.action === "approve" ? `${result.title} is published` : `${result.title} was sent back to draft`,
  })
}
