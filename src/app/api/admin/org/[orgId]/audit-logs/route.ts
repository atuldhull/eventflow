import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import type { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"
import { paginationMeta, parseEnumParam, parseListParams } from "@/lib/list-params"

const AUDIT_ACTIONS = [
  "CREATE", "UPDATE", "DELETE", "LOGIN", "LOGOUT", "EXPORT", "APPROVE", "REJECT",
  "REFUND", "CHECK_IN", "PUBLISH", "CANCEL",
] as const

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { orgId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.AUDIT_VIEW, { organizationId: orgId })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  const searchParams = request.nextUrl.searchParams
  const { page, limit, skip, search } = parseListParams(searchParams, { defaultLimit: 50 })
  const action = parseEnumParam(searchParams, "action", AUDIT_ACTIONS)

  // Always scoped to this organization; the search narrows within it.
  const where: Prisma.AuditLogWhereInput = {
    organizationId: orgId,
    ...(action ? { action } : {}),
    ...(search
      ? {
          OR: [
            { description: { contains: search, mode: "insensitive" } },
            { entityType: { contains: search, mode: "insensitive" } },
            { user: { name: { contains: search, mode: "insensitive" } } },
            { user: { email: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true, action: true, entityType: true, entityId: true,
        description: true, ipAddress: true, createdAt: true,
        user: { select: { name: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ])

  return NextResponse.json({
    success: true,
    data: logs.map((l) => ({ ...l, userName: l.user.name, createdAt: l.createdAt.toISOString() })),
    pagination: paginationMeta(page, limit, total),
  })
}
