import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { createAuditLog, getClientInfo } from "@/lib/audit"
import { PERMISSIONS } from "@/lib/permissions"
import { z } from "zod/v4"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { enterpriseId } = await params

  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_VIEW, { enterpriseId })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  const searchParams = request.nextUrl.searchParams
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "10")
  const search = searchParams.get("search") || ""

  const where: Record<string, unknown> = { enterpriseId, deletedAt: null }
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { slug: { contains: search, mode: "insensitive" } },
    ]
  }

  const [orgs, total] = await Promise.all([
    prisma.organization.findMany({
      where: where as any,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        name: true,
        slug: true,
        category: true,
        isActive: true,
        isVerified: true,
        createdAt: true,
        _count: { select: { events: true, members: true } },
      },
    }),
    prisma.organization.count({ where: where as any }),
  ])

  return NextResponse.json({
    success: true,
    data: orgs,
    pagination: { page, pageSize: limit, total, totalPages: Math.ceil(total / limit) },
  })
}

const createOrgSchema = z.object({
  name: z.string().min(3).max(100),
  slug: z.string().min(3).max(50).regex(/^[a-z0-9-]+$/),
  category: z.string().min(1),
  description: z.string().max(1000).optional().or(z.literal("")),
  email: z.email(),
  phone: z.string().optional().or(z.literal("")),
  website: z.string().url().optional().or(z.literal("")),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { enterpriseId } = await params

  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_CREATE, { enterpriseId })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  try {
    const body = await request.json()
    const parsed = createOrgSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const existing = await prisma.organization.findUnique({ where: { slug: parsed.data.slug } })
    if (existing) {
      return NextResponse.json({ success: false, message: "Slug already in use" }, { status: 409 })
    }

    const org = await prisma.organization.create({
      data: {
        ...parsed.data,
        description: parsed.data.description || null,
        phone: parsed.data.phone || null,
        website: parsed.data.website || null,
        enterpriseId,
      },
    })

    const { ipAddress, userAgent } = getClientInfo(request)
    await createAuditLog({
      userId: session.user.id,
      action: "CREATE",
      entityType: "ORGANIZATION",
      entityId: org.id,
      description: `Created organization: ${org.name}`,
      ipAddress,
      userAgent,
      enterpriseId,
      organizationId: org.id,
    })

    return NextResponse.json({ success: true, data: org }, { status: 201 })
  } catch (error) {
    console.error("Create org error:", error)
    return NextResponse.json({ success: false, message: "Failed to create organization" }, { status: 500 })
  }
}
