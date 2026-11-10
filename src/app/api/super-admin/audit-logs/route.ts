import { NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { withSuperAdmin } from "@/lib/guards"
import prisma from "@/lib/prisma"
import { AUDIT_ACTIONS, cleanSearch, parsePaging } from "@/lib/enterprise-admin"

/**
 * The platform-wide audit log. `?action=` takes one of the AuditAction values (any case;
 * "check-in" works for CHECK_IN); an unknown one is a 400, not a database error.
 */
export const GET = withSuperAdmin(async (req) => {
  const searchParams = req.nextUrl.searchParams
  const { page, limit, skip } = parsePaging(searchParams, 50)
  const rawAction = (searchParams.get("action") || "").trim()
  const entityType = cleanSearch(searchParams.get("entityType"))
  const search = cleanSearch(searchParams.get("search"))

  const action = rawAction
    ? AUDIT_ACTIONS.find((a) => a === rawAction.toUpperCase().replace(/[\s-]+/g, "_"))
    : undefined
  if (rawAction && !action) {
    return NextResponse.json(
      { success: false, message: `Unknown action "${rawAction}". Use one of: ${AUDIT_ACTIONS.join(", ")}` },
      { status: 400 }
    )
  }

  const where: Prisma.AuditLogWhereInput = {}
  if (action) where.action = action
  if (entityType) where.entityType = { equals: entityType, mode: "insensitive" }
  if (search) {
    where.OR = [
      { description: { contains: search, mode: "insensitive" } },
      { entityId: { contains: search } },
      // "what did this person do": match the actor's email or name too
      { user: { email: { contains: search, mode: "insensitive" } } },
      { user: { name: { contains: search, mode: "insensitive" } } },
    ]
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
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
    prisma.auditLog.count({ where }),
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
