import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { withSuperAdmin } from "@/lib/guards"
import prisma from "@/lib/prisma"
import { getClientInfo } from "@/lib/audit"
import { parsePaging, superAdminEnterpriseCreateSchema } from "@/lib/enterprise-admin"
import { createEnterpriseWithOwner } from "@/lib/enterprise-lifecycle"

export const GET = withSuperAdmin(async (req) => {
  const searchParams = req.nextUrl.searchParams
  const { page, limit } = parsePaging(searchParams, 10)
  const search = searchParams.get("search") || ""
  const status = searchParams.get("status") || ""

  const where: Record<string, unknown> = { deletedAt: null }
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { slug: { contains: search, mode: "insensitive" } },
    ]
  }
  if (status === "active") where.isActive = true
  if (status === "inactive") where.isActive = false
  if (status === "verified") where.isVerified = true
  if (status === "unverified") where.isVerified = false

  const [enterprises, total] = await Promise.all([
    prisma.enterprise.findMany({
      where: where as any,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        email: true,
        isActive: true,
        isVerified: true,
        createdAt: true,
        owner: { select: { name: true } },
        _count: { select: { organizations: true, events: true, members: true } },
      },
    }),
    prisma.enterprise.count({ where: where as any }),
  ])

  return NextResponse.json({
    success: true,
    data: enterprises,
    pagination: { page, pageSize: limit, total, totalPages: Math.ceil(total / limit) },
  })
})

/**
 * Create an enterprise owned by an existing account (picked by email). The owner's
 * ENTERPRISE_ADMIN membership is created with it. A bad or taken slug and an unknown
 * owner are answered with 400/409 and the field they concern, never a 500.
 */
export const POST = withSuperAdmin(async (req, { user }) => {
  try {
    const parsed = superAdminEnterpriseCreateSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message ?? "Validation failed", errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { ipAddress, userAgent } = getClientInfo(req)
    const result = await createEnterpriseWithOwner(parsed.data, { id: user.id, ipAddress, userAgent })
    if (!result.ok) {
      return NextResponse.json(
        { success: false, message: result.message, ...(result.field ? { errors: { [result.field]: [result.message] } } : {}) },
        { status: result.status }
      )
    }

    return NextResponse.json(
      { success: true, message: `${result.enterprise.name} created, owned by ${result.owner.email}`, data: { ...result.enterprise, owner: result.owner } },
      { status: 201 }
    )
  } catch (error) {
    console.error("Create enterprise error:", error)
    return NextResponse.json({ success: false, message: "Failed to create enterprise" }, { status: 500 })
  }
})
