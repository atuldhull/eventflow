import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import type { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"
import { createAuditLog, getClientInfo } from "@/lib/audit"
import { enterpriseSettingsUpdateSchema, firstIssue } from "@/lib/enterprise-admin"
import { updateEnterpriseSettings } from "@/lib/enterprise-invites"

const SELECT = {
  name: true, slug: true, type: true, description: true, email: true, phone: true, website: true, settings: true, ownerId: true,
} as const

function shape(e: { ownerId: string; settings: Prisma.JsonValue } & Record<string, unknown>, userId: string) {
  const { ownerId, settings, ...rest } = e
  const s = (settings && typeof settings === "object" && !Array.isArray(settings) ? settings : {}) as Record<string, unknown>
  return {
    ...rest,
    settings: {
      requireEventApproval: s.requireEventApproval === true,
      autoGenerateCertificates: s.autoGenerateCertificates === true,
    },
    isOwner: ownerId === userId,
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  const { enterpriseId } = await params

  const authResult = await authorize(session.user.id, PERMISSIONS.ENTERPRISE_VIEW, { enterpriseId })
  if (!authResult.authorized) return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })

  const enterprise = await prisma.enterprise.findFirst({ where: { id: enterpriseId, deletedAt: null }, select: SELECT })
  if (!enterprise) return NextResponse.json({ success: false, message: "Enterprise not found" }, { status: 404 })

  return NextResponse.json({ success: true, data: shape(enterprise, session.user.id) })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })

  const { enterpriseId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.ENTERPRISE_MANAGE_SETTINGS, { enterpriseId })
  if (!authResult.authorized) return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })

  const body = await request.json().catch(() => null)
  const parsed = enterpriseSettingsUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: firstIssue(parsed.error) }, { status: 400 })
  }

  const current = await prisma.enterprise.findFirst({ where: { id: enterpriseId, deletedAt: null }, select: SELECT })
  if (!current) return NextResponse.json({ success: false, message: "Enterprise not found" }, { status: 404 })

  const { settings: rules, ...fields } = parsed.data
  const data: Prisma.EnterpriseUpdateInput = { ...fields }
  if (rules) {
    // Merged into the JSON column under the row lock, so keys other features keep there
    // (pending invitations, approval decisions) survive a concurrent write.
    await updateEnterpriseSettings(enterpriseId, () => ({ ...rules }))
  }

  const updated = await prisma.enterprise.update({ where: { id: enterpriseId }, data, select: SELECT })

  const { ipAddress, userAgent } = getClientInfo(request)
  await createAuditLog({
    userId: session.user.id,
    action: "UPDATE",
    entityType: "ENTERPRISE",
    entityId: enterpriseId,
    description: `Updated enterprise settings: ${Object.keys(parsed.data).join(", ") || "no changes"}`,
    newValues: parsed.data as Prisma.InputJsonValue,
    ipAddress,
    userAgent,
    enterpriseId,
  })

  return NextResponse.json({ success: true, message: "Settings saved", data: shape(updated, session.user.id) })
}
