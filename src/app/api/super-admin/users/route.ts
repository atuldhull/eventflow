import { NextResponse } from "next/server"
import { withSuperAdmin } from "@/lib/guards"
import prisma from "@/lib/prisma"

export const GET = withSuperAdmin(async (req) => {
  const searchParams = req.nextUrl.searchParams
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "10")
  const search = searchParams.get("search") || ""
  const role = searchParams.get("role") || ""
  const status = searchParams.get("status") || ""

  const where: Record<string, unknown> = { deletedAt: null }
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { phone: { contains: search, mode: "insensitive" } },
    ]
  }
  if (role) where.role = role
  if (status === "active") { where.isActive = true; where.isBanned = false }
  if (status === "banned") where.isBanned = true

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where: where as any,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        isBanned: true,
        lastLoginAt: true,
        createdAt: true,
      },
    }),
    prisma.user.count({ where: where as any }),
  ])

  return NextResponse.json({
    success: true,
    data: users,
    pagination: { page, pageSize: limit, total, totalPages: Math.ceil(total / limit) },
  })
})
