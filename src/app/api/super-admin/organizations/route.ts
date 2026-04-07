import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { withSuperAdmin } from "@/lib/guards"
import prisma from "@/lib/prisma"

export const GET = withSuperAdmin(async (req) => {
  const sp = req.nextUrl.searchParams
  const page = parseInt(sp.get("page") || "1")
  const limit = parseInt(sp.get("limit") || "20")
  const search = sp.get("search") || ""

  const where: any = { deletedAt: null }
  if (search) where.OR = [{ name: { contains: search, mode: "insensitive" } }, { slug: { contains: search, mode: "insensitive" } }]

  const [orgs, total] = await Promise.all([
    prisma.organization.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit, select: { id: true, name: true, slug: true, category: true, email: true, isActive: true, isVerified: true, createdAt: true, enterprise: { select: { name: true } }, _count: { select: { events: true, members: true } } } }),
    prisma.organization.count({ where }),
  ])

  return NextResponse.json({
    success: true,
    data: orgs.map(o => ({ ...o, enterprise: o.enterprise?.name || "Standalone", createdAt: o.createdAt.toISOString() })),
    pagination: { page, pageSize: limit, total, totalPages: Math.ceil(total / limit) },
  })
})
