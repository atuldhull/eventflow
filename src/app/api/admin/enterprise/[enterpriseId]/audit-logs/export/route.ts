import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"
import { createAuditLog, getClientInfo } from "@/lib/audit"
import { cleanSearch, enterpriseAuditWhere } from "@/lib/enterprise-admin"
import { csvResponse, exportDateStamp, toCsv } from "@/lib/csv-export"

const EXPORT_LIMIT = 10_000

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { enterpriseId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.AUDIT_EXPORT, { enterpriseId })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  const sp = request.nextUrl.searchParams
  const search = cleanSearch(sp.get("search"))
  const where = enterpriseAuditWhere(enterpriseId, { search, action: sp.get("action") || "" })

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: EXPORT_LIMIT,
    select: {
      createdAt: true, action: true, entityType: true, entityId: true, description: true, ipAddress: true,
      user: { select: { name: true, email: true } },
    },
  })

  const csv = toCsv(
    ["Time", "User", "User email", "Action", "Entity", "Entity ID", "Description", "IP address"],
    logs.map((l) => [l.createdAt, l.user.name, l.user.email, l.action, l.entityType, l.entityId, l.description, l.ipAddress])
  )

  const { ipAddress, userAgent } = getClientInfo(request)
  await createAuditLog({
    userId: session.user.id,
    action: "EXPORT",
    entityType: "AUDIT_LOG",
    entityId: enterpriseId,
    description: `Exported ${logs.length} audit log entr${logs.length === 1 ? "y" : "ies"}${search ? ` matching "${search}"` : ""}`,
    ipAddress,
    userAgent,
    enterpriseId,
  })

  return csvResponse(`audit-log-${exportDateStamp()}.csv`, csv)
}
