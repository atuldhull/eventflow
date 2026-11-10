import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"
import { cleanSearch, enterpriseAuditWhere, parsePaging } from "@/lib/enterprise-admin"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { enterpriseId } = await params

  const authResult = await authorize(session.user.id, PERMISSIONS.AUDIT_VIEW, { enterpriseId })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  const sp = request.nextUrl.searchParams
  const { page, limit, skip } = parsePaging(sp, 50)
  const where = enterpriseAuditWhere(enterpriseId, { search: cleanSearch(sp.get("search")), action: sp.get("action") || "" })

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
        createdAt: true,
        user: { select: { name: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ])

  return NextResponse.json({
    success: true,
    data: logs.map((l) => ({
      ...l,
      userName: l.user.name,
      createdAt: l.createdAt.toISOString(),
    })),
    pagination: { page, pageSize: limit, total, totalPages: Math.ceil(total / limit) },
  })
}
