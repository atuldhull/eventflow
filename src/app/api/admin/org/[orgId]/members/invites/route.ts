import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { z } from "zod/v4"
import { auth } from "@/lib/auth"
import { authorize } from "@/lib/authorization"
import { canManageRole, PERMISSIONS } from "@/lib/permissions"
import { createAuditLog, getClientInfo } from "@/lib/audit"
import { readOrgSettings } from "@/lib/org-settings"
import { readPendingInvites, removePendingInvite } from "@/lib/org-invites"
import type { Role } from "@/lib/constants"

const cancelSchema = z.object({ email: z.email().transform((e) => e.trim().toLowerCase()) })

/** Cancels a pending invitation (one sent to someone without an account). */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { orgId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.MEMBER_INVITE, { organizationId: orgId })
  if (!authResult.authorized || !authResult.role) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  const parsed = cancelSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "Validation failed" }, { status: 400 })
  }
  const { email } = parsed.data

  const settings = await readOrgSettings(orgId)
  if (!settings) return NextResponse.json({ success: false, message: "Organization not found" }, { status: 404 })
  const invite = readPendingInvites(settings).find((i) => i.email === email)
  if (!invite) {
    return NextResponse.json({ success: false, message: "Invitation not found" }, { status: 404 })
  }
  // the same rank rule as sending it: only someone above the invited role can withdraw it
  if (!canManageRole(authResult.role, invite.role as Role)) {
    return NextResponse.json({ success: false, message: "You cannot cancel an invitation for an equal or higher role." }, { status: 403 })
  }

  await removePendingInvite(orgId, email)

  const { ipAddress, userAgent } = getClientInfo(request)
  await createAuditLog({
    userId: session.user.id,
    action: "DELETE",
    entityType: "ORGANIZATION",
    entityId: orgId,
    description: `Cancelled the invitation for ${email}`,
    oldValues: { email, role: invite.role },
    ipAddress,
    userAgent,
    organizationId: orgId,
  })

  return NextResponse.json({ success: true, message: "Invitation cancelled" })
}
