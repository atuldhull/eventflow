import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import type { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"
import { createAuditLog, getClientInfo } from "@/lib/audit"
import { clearTenantCache } from "@/lib/tenant"
import { enterpriseBrandingUpdateSchema, firstIssue } from "@/lib/enterprise-admin"

const SELECT = {
  slug: true, logo: true, banner: true, primaryColor: true, secondaryColor: true, customDomain: true, subdomain: true,
} as const

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

  return NextResponse.json({ success: true, data: enterprise })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })

  const { enterpriseId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.ENTERPRISE_EDIT, { enterpriseId })
  if (!authResult.authorized) return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })

  const body = await request.json().catch(() => null)
  const parsed = enterpriseBrandingUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: firstIssue(parsed.error) }, { status: 400 })
  }

  const current = await prisma.enterprise.findFirst({ where: { id: enterpriseId, deletedAt: null }, select: SELECT })
  if (!current) return NextResponse.json({ success: false, message: "Enterprise not found" }, { status: 404 })

  const updated = await prisma.enterprise.update({ where: { id: enterpriseId }, data: parsed.data, select: SELECT })

  // Tenant pages cache the enterprise's look; drop the cached copy so they pick this up.
  if (updated.customDomain) clearTenantCache(updated.customDomain)

  const { ipAddress, userAgent } = getClientInfo(request)
  await createAuditLog({
    userId: session.user.id,
    action: "UPDATE",
    entityType: "ENTERPRISE",
    entityId: enterpriseId,
    description: `Updated enterprise branding: ${Object.keys(parsed.data).join(", ") || "no changes"}`,
    oldValues: Object.fromEntries(Object.keys(parsed.data).map((k) => [k, current[k as keyof typeof current] ?? null])) as Prisma.InputJsonValue,
    newValues: parsed.data as Prisma.InputJsonValue,
    ipAddress,
    userAgent,
    enterpriseId,
  })

  return NextResponse.json({ success: true, message: "Branding saved", data: updated })
}
