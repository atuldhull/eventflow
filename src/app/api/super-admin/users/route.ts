import { NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { withSuperAdmin } from "@/lib/guards"
import prisma from "@/lib/prisma"
import { cleanSearch, parsePaging, startOfMonth } from "@/lib/enterprise-admin"

const ROLES = ["SUPER_ADMIN", "ENTERPRISE_ADMIN", "ENTERPRISE_MANAGER", "ORG_ADMIN", "EVENT_MANAGER", "COORDINATOR", "FINANCE_MANAGER", "VIEWER", "USER"] as const

export const GET = withSuperAdmin(async (req) => {
  const sp = req.nextUrl.searchParams
  const { page, limit, skip } = parsePaging(sp, 10)
  const search = cleanSearch(sp.get("search"))
  const role = ROLES.find((r) => r === sp.get("role"))
  const status = sp.get("status") || ""

  const where: Prisma.UserWhereInput = { deletedAt: null }
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

  // KPIs are platform-wide; the search/filter only narrows the list.
  const base: Prisma.UserWhereInput = { deletedAt: null }
  const [users, total, allUsers, active, banned, newThisMonth] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        isBanned: true,
        banReason: true,
        emailVerified: true,
        lastLoginAt: true,
        createdAt: true,
      },
    }),
    prisma.user.count({ where }),
    prisma.user.count({ where: base }),
    prisma.user.count({ where: { ...base, isActive: true, isBanned: false } }),
    prisma.user.count({ where: { ...base, isBanned: true } }),
    prisma.user.count({ where: { ...base, createdAt: { gte: startOfMonth() } } }),
  ])

  return NextResponse.json({
    success: true,
    data: users,
    stats: { total: allUsers, active, banned, newThisMonth },
    pagination: { page, pageSize: limit, total, totalPages: Math.ceil(total / limit) },
  })
})
