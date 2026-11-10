import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"
import { createAuditLog, getClientInfo } from "@/lib/audit"
import { cleanSearch, enterpriseRegistrationWhere } from "@/lib/enterprise-admin"
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
  const authResult = await authorize(session.user.id, PERMISSIONS.REGISTRATION_EXPORT, { enterpriseId })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  const search = cleanSearch(request.nextUrl.searchParams.get("search"))
  const registrations = await prisma.registration.findMany({
    where: enterpriseRegistrationWhere(enterpriseId, search),
    orderBy: { createdAt: "desc" },
    take: EXPORT_LIMIT,
    select: {
      registrationNumber: true, status: true, source: true, createdAt: true,
      user: { select: { name: true, email: true, phone: true } },
      event: { select: { title: true, organization: { select: { name: true } } } },
      ticketType: { select: { name: true, price: true } },
    },
  })

  const csv = toCsv(
    ["Registration #", "Participant", "Email", "Phone", "Event", "Organization", "Ticket", "Amount", "Status", "Source", "Registered on"],
    registrations.map((r) => [
      r.registrationNumber,
      r.user.name,
      r.user.email,
      r.user.phone,
      r.event.title,
      r.event.organization?.name || "Direct",
      r.ticketType?.name || "General",
      r.ticketType ? Number(r.ticketType.price) : 0,
      r.status,
      r.source || "WEB",
      r.createdAt,
    ])
  )

  const { ipAddress, userAgent } = getClientInfo(request)
  await createAuditLog({
    userId: session.user.id,
    action: "EXPORT",
    entityType: "REGISTRATION",
    entityId: enterpriseId,
    description: `Exported ${registrations.length} registration${registrations.length === 1 ? "" : "s"}${search ? ` matching "${search}"` : ""}`,
    ipAddress,
    userAgent,
    enterpriseId,
  })

  return csvResponse(`registrations-${exportDateStamp()}.csv`, csv)
}
