import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { z } from "zod/v4"
import { withSuperAdmin } from "@/lib/guards"
import prisma from "@/lib/prisma"
import { createAuditLog, getClientInfo } from "@/lib/audit"
import { firstIssue, superAdminEnterpriseUpdateSchema } from "@/lib/enterprise-admin"
import { softDeleteEnterprise } from "@/lib/enterprise-lifecycle"

const DETAIL_SELECT = {
  id: true, name: true, slug: true, type: true, description: true, email: true, phone: true, website: true,
  city: true, state: true, country: true, isActive: true, isVerified: true, customDomain: true, createdAt: true, updatedAt: true,
  owner: { select: { id: true, name: true, email: true } },
  subscription: { select: { plan: true, status: true } },
  _count: { select: { organizations: true, events: true, members: true } },
} as const

export const GET = withSuperAdmin(async (req, { params }) => {
  const enterprise = await prisma.enterprise.findFirst({
    where: { id: params.id, deletedAt: null },
    select: DETAIL_SELECT,
  })

  if (!enterprise) {
    return NextResponse.json({ success: false, message: "Enterprise not found" }, { status: 404 })
  }

  return NextResponse.json({ success: true, data: enterprise })
})

export const PATCH = withSuperAdmin(async (req, { user, params }) => {
  const parsed = superAdminEnterpriseUpdateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: firstIssue(parsed.error) }, { status: 400 })
  }

  try {
    const current = await prisma.enterprise.findFirst({
      where: { id: params.id, deletedAt: null },
      select: { name: true, email: true, type: true, description: true, phone: true, website: true },
    })
    if (!current) {
      return NextResponse.json({ success: false, message: "Enterprise not found" }, { status: 404 })
    }

    const enterprise = await prisma.enterprise.update({
      where: { id: params.id },
      data: parsed.data,
      select: DETAIL_SELECT,
    })

    const changed = Object.keys(parsed.data) as (keyof typeof current)[]
    const { ipAddress, userAgent } = getClientInfo(req)
    await createAuditLog({
      userId: user.id,
      action: "UPDATE",
      entityType: "ENTERPRISE",
      entityId: params.id,
      description: `Updated enterprise: ${enterprise.name}`,
      oldValues: Object.fromEntries(changed.map((k) => [k, current[k] ?? null])) as Prisma.InputJsonValue,
      newValues: parsed.data as Prisma.InputJsonValue,
      ipAddress,
      userAgent,
      enterpriseId: params.id,
    })

    return NextResponse.json({ success: true, message: "Enterprise updated", data: enterprise })
  } catch (error) {
    console.error("Update enterprise error:", error)
    return NextResponse.json({ success: false, message: "Failed to update enterprise" }, { status: 500 })
  }
})

const deleteSchema = z.object({ confirm: z.string().min(1) })

/** Soft delete, guarded by the enterprise's name typed as confirmation (checked here too). */
export const DELETE = withSuperAdmin(async (req, { user, params }) => {
  const parsed = deleteSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "Type the enterprise name to confirm." }, { status: 400 })
  }

  try {
    const { ipAddress, userAgent } = getClientInfo(req)
    const result = await softDeleteEnterprise({
      enterpriseId: params.id,
      actorId: user.id,
      confirm: parsed.data.confirm,
      ipAddress,
      userAgent,
      via: "super-admin",
    })
    if (!result.ok) {
      return NextResponse.json({ success: false, message: result.message }, { status: result.status })
    }
    return NextResponse.json({ success: true, message: `${result.name} was deleted` })
  } catch (error) {
    console.error("Delete enterprise error:", error)
    return NextResponse.json({ success: false, message: "Failed to delete enterprise" }, { status: 500 })
  }
})
