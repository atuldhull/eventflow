import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"
import { asObject, readOrgSettings } from "@/lib/org-settings"
import { COMMUNICATION_ENTITY, readDrafts } from "@/lib/org-communications"

/**
 * What the communications screen needs in one call: the organization's events (to pick
 * recipients and announcement targets), its saved email drafts, and its sent history.
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
  const authResult = await authorize(
    session.user.id,
    [PERMISSIONS.COMMUNICATION_VIEW_HISTORY, PERMISSIONS.COMMUNICATION_SEND_EMAIL, PERMISSIONS.COMMUNICATION_SEND_ANNOUNCEMENT],
    { organizationId: orgId }
  )
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  const [settings, events, history] = await Promise.all([
    readOrgSettings(orgId),
    prisma.event.findMany({
      where: { organizationId: orgId, deletedAt: null, status: { not: "DRAFT" } },
      orderBy: { startDate: "desc" },
      take: 200,
      select: { id: true, title: true, startDate: true, status: true },
    }),
    prisma.auditLog.findMany({
      where: {
        organizationId: orgId,
        OR: [
          { entityType: COMMUNICATION_ENTITY },
          // sends logged before the history had its own entity type
          { entityType: "ORGANIZATION", description: { startsWith: "Sent email" } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, description: true, newValues: true, createdAt: true, user: { select: { name: true } } },
    }),
  ])
  if (!settings) return NextResponse.json({ success: false, message: "Organization not found" }, { status: 404 })

  return NextResponse.json({
    success: true,
    data: {
      events: events.map((e) => ({ ...e, startDate: e.startDate.toISOString() })),
      drafts: readDrafts(settings),
      sent: history.map((h) => {
        const v = asObject(h.newValues)
        const legacy = h.description?.match(/^Sent email "(.*)" to (\d+) recipients$/)
        return {
          id: h.id,
          subject: typeof v.subject === "string" ? v.subject : legacy?.[1] ?? h.description ?? "",
          recipients: typeof v.recipients === "number" ? v.recipients : legacy ? Number(legacy[2]) : null,
          audience: typeof v.audience === "string" ? v.audience : null,
          sentBy: h.user.name,
          sentAt: h.createdAt.toISOString(),
        }
      }),
    },
  })
}
