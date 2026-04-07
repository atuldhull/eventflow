import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"
import { createAuditLog, getClientInfo } from "@/lib/audit"
import { clearTenantCache } from "@/lib/tenant"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { enterpriseId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.ENTERPRISE_MANAGE_SETTINGS, { enterpriseId })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  const enterprise = await prisma.enterprise.findUnique({
    where: { id: enterpriseId },
    select: { customDomain: true },
  })

  if (enterprise?.customDomain) {
    clearTenantCache(enterprise.customDomain)
  }

  await prisma.enterprise.update({
    where: { id: enterpriseId },
    data: { customDomain: null },
  })

  const { ipAddress, userAgent } = getClientInfo(request)
  await createAuditLog({
    userId: session.user.id,
    action: "UPDATE",
    entityType: "ENTERPRISE",
    entityId: enterpriseId,
    description: "Removed custom domain",
    ipAddress,
    userAgent,
    enterpriseId,
  })

  return NextResponse.json({ success: true, message: "Custom domain removed" })
}
