import { NextResponse } from "next/server"
import { withSuperAdmin } from "@/lib/guards"
import prisma from "@/lib/prisma"

export const GET = withSuperAdmin(async (req) => {
  const searchParams = req.nextUrl.searchParams
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "50")
  const action = searchParams.get("action") || ""
  const entityType = searchParams.get("entityType") || ""
  const search = searchParams.get("search") || ""

  const where: Record<string, unknown> = {}
  if (action) where.action = action
  if (entityType) where.entityType = entityType
  if (search) {
    where.OR = [
      { description: { contains: search, mode: "insensitive" } },
      { entityId: { contains: search } },
    ]
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where: where as any,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        description: true,
        ipAddress: true,
        oldValues: true,
        newValues: true,
        createdAt: true,
        user: { select: { id: true, name: true } },
      },
    }),
    prisma.auditLog.count({ where: where as any }),
  ])

  return NextResponse.json({
    success: true,
    data: logs.map((l) => ({
      ...l,
      userName: l.user.name,
      userId: l.user.id,
      createdAt: l.createdAt.toISOString(),
    })),
    pagination: { page, pageSize: limit, total, totalPages: Math.ceil(total / limit) },
  })
})
