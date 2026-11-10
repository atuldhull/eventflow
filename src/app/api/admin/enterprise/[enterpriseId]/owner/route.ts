import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { authorize, isEnterpriseOwner } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"
import { getClientInfo } from "@/lib/audit"
import { transferOwnershipSchema } from "@/lib/enterprise-admin"
import { transferEnterpriseOwnership } from "@/lib/enterprise-lifecycle"

/**
 * Transfer ownership of the enterprise to another existing account. Only the current
 * owner (while still an active member) or a super admin may, with the enterprise name typed
 * as confirmation; the change is audited and the new owner becomes an enterprise admin.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { enterpriseId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.ENTERPRISE_VIEW, { enterpriseId })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }
  if (authResult.role !== "SUPER_ADMIN" && !(await isEnterpriseOwner(enterpriseId, session.user.id))) {
    return NextResponse.json({ success: false, message: "Only the enterprise owner can transfer ownership." }, { status: 403 })
  }

  const parsed = transferOwnershipSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message ?? "Validation failed" }, { status: 400 })
  }

  const { ipAddress, userAgent } = getClientInfo(request)
  const result = await transferEnterpriseOwnership({
    enterpriseId,
    actorId: session.user.id,
    newOwnerEmail: parsed.data.newOwnerEmail,
    confirm: parsed.data.confirm,
    ipAddress,
    userAgent,
  })
  if (!result.ok) {
    return NextResponse.json(
      { success: false, message: result.message, ...(result.field ? { errors: { [result.field]: [result.message] } } : {}) },
      { status: result.status }
    )
  }

  return NextResponse.json({
    success: true,
    message: `${result.newOwner.name || result.newOwner.email} now owns ${result.name}`,
    data: { newOwner: result.newOwner },
  })
}
