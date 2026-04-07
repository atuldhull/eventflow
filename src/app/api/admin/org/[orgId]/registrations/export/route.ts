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
  const authResult = await authorize(session.user.id, PERMISSIONS.REGISTRATION_EXPORT, { organizationId: orgId })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  const registrations = await prisma.registration.findMany({
    where: { event: { organizationId: orgId, deletedAt: null } },
    orderBy: { createdAt: "desc" },
    select: {
      registrationNumber: true, status: true, createdAt: true, source: true, notes: true,
      user: { select: { name: true, email: true, phone: true } },
      event: { select: { title: true } },
      ticketType: { select: { name: true, price: true } },
      formResponses: true,
    },
  })

  // Build CSV
  const headers = ["Registration #", "Participant Name", "Email", "Phone", "Event", "Ticket Type", "Amount", "Status", "Source", "Registered On"]
  const rows = registrations.map((r) => [
    r.registrationNumber,
    r.user.name || "",
    r.user.email,
    r.user.phone || "",
    r.event.title,
    r.ticketType?.name || "General",
    r.ticketType ? Number(r.ticketType.price) : 0,
    r.status,
    r.source || "WEB",
    r.createdAt.toISOString().split("T")[0],
  ])

  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
  ].join("\n")

  return new NextResponse(csvContent, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="registrations-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  })
}
