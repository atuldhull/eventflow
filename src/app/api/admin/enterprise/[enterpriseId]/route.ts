import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { z } from "zod/v4"
import { auth } from "@/lib/auth"
import { authorize, isEnterpriseOwner } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"
import { getClientInfo } from "@/lib/audit"
import { softDeleteEnterprise } from "@/lib/enterprise-lifecycle"

const deleteSchema = z.object({ confirm: z.string().min(1, "Type the enterprise name to confirm") })

/**
 * Delete (soft) the enterprise from its own settings page. Only its owner may do this
 * (plus super admins), on top of the ENTERPRISE_DELETE permission, and only with the
 * enterprise name typed as confirmation.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { enterpriseId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.ENTERPRISE_DELETE, { enterpriseId })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }
  if (authResult.role !== "SUPER_ADMIN" && !(await isEnterpriseOwner(enterpriseId, session.user.id))) {
    return NextResponse.json({ success: false, message: "Only the enterprise owner can delete it." }, { status: 403 })
  }

  const parsed = deleteSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "Type the enterprise name to confirm." }, { status: 400 })
  }

  const { ipAddress, userAgent } = getClientInfo(request)
  const result = await softDeleteEnterprise({
    enterpriseId,
    actorId: session.user.id,
    confirm: parsed.data.confirm,
    ipAddress,
    userAgent,
    via: authResult.role === "SUPER_ADMIN" ? "super-admin" : "enterprise-owner",
  })
  if (!result.ok) {
    return NextResponse.json({ success: false, message: result.message }, { status: result.status })
  }

  return NextResponse.json({ success: true, message: `${result.name} was deleted` })
}
