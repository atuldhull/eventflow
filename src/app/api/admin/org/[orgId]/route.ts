import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { z } from "zod/v4"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"
import { createAuditLog, getClientInfo } from "@/lib/audit"

const deleteSchema = z.object({ confirmName: z.string().trim().min(1) })

/**
 * Deletes (soft-deletes: hidden and inactive, data kept) an organization. Needs
 * org:delete in this organization's context, which only enterprise admins/managers of its
 * parent enterprise and super admins hold; an organization's own admins can't delete it.
 * The caller must repeat the organization's name.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { orgId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_DELETE, { organizationId: orgId })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  const parsed = deleteSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "Type the organization's name to confirm" }, { status: 400 })
  }

  const org = await prisma.organization.findFirst({
    where: { id: orgId, deletedAt: null },
    select: { name: true, enterpriseId: true },
  })
  if (!org) return NextResponse.json({ success: false, message: "Organization not found" }, { status: 404 })
  if (parsed.data.confirmName !== org.name) {
    return NextResponse.json({ success: false, message: "The name doesn't match" }, { status: 400 })
  }

  await prisma.organization.update({
    where: { id: orgId },
    data: { deletedAt: new Date(), isActive: false },
  })

  const { ipAddress, userAgent } = getClientInfo(request)
  await createAuditLog({
    userId: session.user.id,
    action: "DELETE",
    entityType: "ORGANIZATION",
    entityId: orgId,
    description: `Deleted organization ${org.name}`,
    ipAddress,
    userAgent,
    organizationId: orgId,
    ...(org.enterpriseId ? { enterpriseId: org.enterpriseId } : {}),
  })

  return NextResponse.json({ success: true, message: "Organization deleted" })
}
