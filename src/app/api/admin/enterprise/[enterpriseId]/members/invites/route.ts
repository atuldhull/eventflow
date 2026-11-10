import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { z } from "zod/v4"
import { auth } from "@/lib/auth"
import { authorize, isEnterpriseOwner } from "@/lib/authorization"
import { canManageEnterpriseRole, PERMISSIONS } from "@/lib/permissions"
import { createAuditLog, getClientInfo } from "@/lib/audit"
import { readEnterprisePendingInvites, readEnterpriseSettings, removeEnterprisePendingInvite } from "@/lib/enterprise-invites"
import type { Role } from "@/lib/constants"

const cancelSchema = z.object({ email: z.email().transform((e) => e.trim().toLowerCase()) })

/** Cancels a pending enterprise invitation (one sent to someone without an account). */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { enterpriseId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.MEMBER_INVITE, { enterpriseId })
  if (!authResult.authorized || !authResult.role) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  const parsed = cancelSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "Enter the invited email address" }, { status: 400 })
  }
  const { email } = parsed.data

  const settings = await readEnterpriseSettings(enterpriseId)
  if (!settings) return NextResponse.json({ success: false, message: "Enterprise not found" }, { status: 404 })
  const invite = readEnterprisePendingInvites(settings).find((i) => i.email === email)
  if (!invite) {
    return NextResponse.json({ success: false, message: "Invitation not found" }, { status: 404 })
  }
  // the same rank rule as sending it: only someone above the invited role (or the owner,
  // for a co-admin invitation) can withdraw it
  const isOwner = await isEnterpriseOwner(enterpriseId, session.user.id)
  if (!canManageEnterpriseRole(authResult.role, invite.role as Role, isOwner)) {
    return NextResponse.json({ success: false, message: "You cannot cancel an invitation for an equal or higher role." }, { status: 403 })
  }

  await removeEnterprisePendingInvite(enterpriseId, email)

  const { ipAddress, userAgent } = getClientInfo(request)
  await createAuditLog({
    userId: session.user.id,
    action: "DELETE",
    entityType: "ENTERPRISE",
    entityId: enterpriseId,
    description: `Cancelled the invitation for ${email}`,
    oldValues: { email, role: invite.role },
    ipAddress,
    userAgent,
    enterpriseId,
  })

  return NextResponse.json({ success: true, message: "Invitation cancelled" })
}
