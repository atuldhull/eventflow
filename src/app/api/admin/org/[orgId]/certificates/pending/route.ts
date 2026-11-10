import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"

const ELIGIBLE = ["CONFIRMED", "CHECKED_IN"] as const

/**
 * This organization's finished events that still have participants without a
 * certificate: what "Generate" on the certificates page works through.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { orgId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.CERTIFICATE_VIEW, { organizationId: orgId })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  const events = await prisma.event.findMany({
    where: {
      organizationId: orgId,
      deletedAt: null,
      status: { notIn: ["CANCELLED", "DRAFT"] },
      OR: [{ status: "COMPLETED" }, { endDate: { lt: new Date() } }],
    },
    orderBy: { endDate: "desc" },
    take: 50,
    select: { id: true, title: true, endDate: true, status: true },
  })

  const ids = events.map((e) => e.id)
  const [eligible, issued, templates] = await Promise.all([
    ids.length
      ? prisma.registration.groupBy({ by: ["eventId"], where: { eventId: { in: ids }, status: { in: [...ELIGIBLE] } }, _count: { _all: true } })
      : [],
    ids.length
      ? prisma.certificate.groupBy({ by: ["eventId"], where: { eventId: { in: ids } }, _count: { _all: true } })
      : [],
    prisma.certificateTemplate.findMany({
      where: { organizationId: orgId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      select: { id: true, name: true, isDefault: true },
    }),
  ])
  const eligibleBy = new Map(eligible.map((e) => [e.eventId, e._count._all]))
  const issuedBy = new Map(issued.map((c) => [c.eventId, c._count._all]))

  // What Generate would create, per event: eligible participants who don't have this
  // event's certificate yet, split by whether they checked in (no-shows stay CONFIRMED).
  const missing = await Promise.all(
    events.map((e) =>
      prisma.registration.groupBy({
        by: ["status"],
        where: { eventId: e.id, status: { in: [...ELIGIBLE] }, user: { certificates: { none: { eventId: e.id } } } },
        _count: { _all: true },
      })
    )
  )

  const data = events
    .map((e, i) => {
      const rows = missing[i] ?? []
      const checkedIn = rows.find((r) => r.status === "CHECKED_IN")?._count._all ?? 0
      const all = rows.reduce((n, r) => n + r._count._all, 0)
      return {
        eventId: e.id,
        title: e.title,
        endDate: e.endDate.toISOString(),
        eligible: eligibleBy.get(e.id) ?? 0,
        issued: issuedBy.get(e.id) ?? 0,
        /** certificates Generate creates: checkedIn with "Checked-in only" (the default), all without */
        toGenerate: { checkedIn, all },
      }
    })
    .filter((e) => e.toGenerate.all > 0)

  return NextResponse.json({ success: true, data, templates })
}
