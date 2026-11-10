import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import type { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"
import { createAuditLog, getClientInfo } from "@/lib/audit"
import { asObject, updateOrgSettings } from "@/lib/org-settings"
import {
  normalizeProfileInput,
  orgColumnsFromUpdate,
  orgProfileFromRecord,
  orgProfileSchema,
} from "@/lib/org-profile"

const PROFILE_SELECT = {
  name: true, category: true, description: true, email: true, phone: true, website: true,
  address: true, city: true, state: true, socialLinks: true, settings: true, enterpriseId: true,
} as const

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  const { orgId } = await params

  // Only people with a role in this organization (or above it) may read its settings.
  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_VIEW, { organizationId: orgId })
  if (!authResult.authorized) return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })

  const org = await prisma.organization.findFirst({ where: { id: orgId, deletedAt: null }, select: PROFILE_SELECT })
  if (!org) return NextResponse.json({ success: false, message: "Organization not found" }, { status: 404 })

  return NextResponse.json({
    success: true,
    data: { ...orgProfileFromRecord(org), enterpriseId: org.enterpriseId },
  })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  const { orgId } = await params

  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_MANAGE_SETTINGS, { organizationId: orgId })
  if (!authResult.authorized) return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })

  const body = await request.json().catch(() => null)
  const parsed = orgProfileSchema.safeParse(normalizeProfileInput(body))
  if (!parsed.success) {
    const fieldErrors = Object.fromEntries(
      parsed.error.issues.map((issue) => [issue.path.join("."), issue.message])
    )
    const first = parsed.error.issues[0]
    return NextResponse.json(
      { success: false, message: first ? `${first.path.join(".") || "Request"}: ${first.message}` : "Validation failed", errors: fieldErrors },
      { status: 400 }
    )
  }
  const update = parsed.data

  const existing = await prisma.organization.findFirst({ where: { id: orgId, deletedAt: null }, select: PROFILE_SELECT })
  if (!existing) return NextResponse.json({ success: false, message: "Organization not found" }, { status: 404 })

  const data: Prisma.OrganizationUpdateInput = orgColumnsFromUpdate(update)
  if (update.socialLinks) {
    // keep any links this form doesn't edit (e.g. ones set elsewhere)
    const merged: Record<string, unknown> = { ...asObject(existing.socialLinks) }
    for (const [key, value] of Object.entries(update.socialLinks)) {
      if (value) merged[key] = value
      else delete merged[key]
    }
    data.socialLinks = merged as Prisma.InputJsonObject
  }

  if (Object.keys(data).length > 0) {
    await prisma.organization.update({ where: { id: orgId }, data })
  }
  if (update.billing || update.eventDefaults) {
    await updateOrgSettings(orgId, (current) => ({
      ...(update.billing ? { billing: { ...asObject(current.billing), ...update.billing } } : {}),
      ...(update.eventDefaults ? { eventDefaults: { ...asObject(current.eventDefaults), ...update.eventDefaults } } : {}),
    }))
  }

  const { ipAddress, userAgent } = getClientInfo(request)
  await createAuditLog({
    userId: session.user.id,
    action: "UPDATE",
    entityType: "ORGANIZATION",
    entityId: orgId,
    description: `Updated organization settings (${Object.keys(update).join(", ") || "no changes"})`,
    newValues: update as Prisma.InputJsonObject,
    ipAddress,
    userAgent,
    organizationId: orgId,
  })

  const saved = await prisma.organization.findUnique({ where: { id: orgId }, select: PROFILE_SELECT })
  return NextResponse.json({
    success: true,
    message: "Settings saved",
    data: saved ? { ...orgProfileFromRecord(saved), enterpriseId: saved.enterpriseId } : null,
  })
}
