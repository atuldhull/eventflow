import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { withSuperAdmin } from "@/lib/guards"
import prisma from "@/lib/prisma"
import { createAuditLog, getClientInfo } from "@/lib/audit"
import { z } from "zod/v4"

export const GET = withSuperAdmin(async (req) => {
  const searchParams = req.nextUrl.searchParams
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "10")
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

const createSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2),
  email: z.email(),
  type: z.string().optional(),
  description: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
  ownerId: z.string(),
})

export const POST = withSuperAdmin(async (req, { user }) => {
  try {
    const body = await req.json()
    // Allow "current" as ownerId to use the logged-in user
    if (body.ownerId === "current") body.ownerId = user.id
    const parsed = createSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const enterprise = await prisma.enterprise.create({ data: parsed.data as any })

    const { ipAddress, userAgent } = getClientInfo(req)
    await createAuditLog({
      userId: user.id,
      action: "CREATE",
      entityType: "ENTERPRISE",
      entityId: enterprise.id,
      description: `Created enterprise: ${enterprise.name}`,
      ipAddress,
      userAgent,
      enterpriseId: enterprise.id,
    })

    return NextResponse.json({ success: true, data: enterprise }, { status: 201 })
  } catch (error) {
    console.error("Create enterprise error:", error)
    return NextResponse.json({ success: false, message: "Failed to create enterprise" }, { status: 500 })
  }
})
