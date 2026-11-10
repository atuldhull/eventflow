import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { authorize } from "@/lib/authorization"
import { getClientInfo } from "@/lib/audit"
import { PERMISSIONS } from "@/lib/permissions"
import { refundOrgPayment } from "@/lib/org-refund"
import { z } from "zod/v4"

const refundSchema = z.object({
  amount: z.number().positive().max(10_000_000).optional(),
  reason: z.string().trim().max(500).optional(),
})

// Refunds one payment: through Razorpay for online payments, recorded only for cash or
// bank transfers. See refundOrgPayment for the rules.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; paymentId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { orgId, paymentId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.PAYMENT_MANAGE, { organizationId: orgId })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  const parsed = refundSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "Validation failed" }, { status: 400 })
  }

  const result = await refundOrgPayment({
    orgId, paymentId, actorId: session.user.id, amount: parsed.data.amount, reason: parsed.data.reason,
    audit: getClientInfo(request),
  })
  return NextResponse.json(
    result.ok ? { success: true, message: result.message, data: { refundAmount: result.refundAmount, full: result.full } } : { success: false, message: result.message },
    { status: result.status }
  )
}
