import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { authorize } from "@/lib/authorization"
import { getClientInfo } from "@/lib/audit"
import { PERMISSIONS } from "@/lib/permissions"
import { bulkDecisionSchema, decideEventApprovals, summarizeBulkDecision } from "@/lib/enterprise-event-approval"

/**
 * Approve or reject up to 100 pending events at once: { action, eventIds, reason }. A
 * rejection needs a reason (the same rule as a single one) and it is applied to every event.
 * Each id goes through the single-event decision (enterprise scope, status check,
 * notifications, audit log), so an id from another enterprise, or one that is no longer
 * pending, fails on its own without stopping the rest. Answers with a result per id:
 * data.results = [{ id, ok, message }].
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

  const parsed = bulkDecisionSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message ?? "Validation failed" }, { status: 400 })
  }

  const { action, eventIds, reason } = parsed.data
  const { ipAddress, userAgent } = getClientInfo(request)
  const results = await decideEventApprovals({
    enterpriseId,
    eventIds,
    action,
    reason,
    actor: { id: session.user.id, name: session.user.name },
    ipAddress,
    userAgent,
  })
  const succeeded = results.filter((r) => r.ok).length

  return NextResponse.json(
    {
      success: succeeded > 0,
      message: summarizeBulkDecision(action, results),
      data: { action, results, succeeded, failed: results.length - succeeded },
    },
    { status: succeeded > 0 ? 200 : 409 }
  )
}
