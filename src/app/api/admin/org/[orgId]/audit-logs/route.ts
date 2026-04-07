import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"

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
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "50")

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true, action: true, entityType: true, entityId: true,
        description: true, ipAddress: true, createdAt: true,
        user: { select: { name: true } },
      },
    }),
    prisma.auditLog.count({ where: { organizationId: orgId } }),
  ])

  return NextResponse.json({
    success: true,
    data: logs.map((l) => ({ ...l, userName: l.user.name, createdAt: l.createdAt.toISOString() })),
    pagination: { page, pageSize: limit, total, totalPages: Math.ceil(total / limit) },
  })
}
