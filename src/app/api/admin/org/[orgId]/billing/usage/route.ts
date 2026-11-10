import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"
import { PLAN_CONFIG, checkEventLimit, formatResetDate } from "@/lib/subscription"

// registrations that hold a seat
const SEATED = ["PENDING", "CONFIRMED", "CHECKED_IN"] as const

/**
 * The organization's real usage against its plan's limits (src/lib/subscription.ts): events
 * created this month with exactly the figures the create / duplicate check enforces
 * (checkEventLimit: the enterprise's plan and enterprise-wide count for an enterprise
 * organization; the count resets on the 1st), active
 * team members, and the busiest current or upcoming event against participants per event.
 * A limit of -1 means unlimited.
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
  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_VIEW, { organizationId: orgId })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  const org = await prisma.organization.findFirst({ where: { id: orgId, deletedAt: null }, select: { id: true } })
  if (!org) return NextResponse.json({ success: false, message: "Organization not found" }, { status: 404 })

  const [events, memberCount, subscription, busiest] = await Promise.all([
    checkEventLimit(orgId),
    prisma.organizationMember.count({ where: { organizationId: orgId, isActive: true } }),
    prisma.subscription.findFirst({
      where: { organizationId: orgId },
      select: { status: true, currentPeriodStart: true, currentPeriodEnd: true },
    }),
    prisma.registration.groupBy({
      by: ["eventId"],
      where: {
        status: { in: [...SEATED] },
        event: { organizationId: orgId, deletedAt: null, endDate: { gte: new Date() }, status: { not: "CANCELLED" } },
      },
      _count: { _all: true },
      orderBy: { _count: { eventId: "desc" } },
      take: 1,
    }),
  ])

  const top = busiest[0]
  const topEvent = top
    ? await prisma.event.findUnique({ where: { id: top.eventId }, select: { title: true } })
    : null

  const limits = PLAN_CONFIG[events.plan].limits
  const sharedWithEnterprise = events.scope.entityType === "enterprise"
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  return NextResponse.json({
    success: true,
    data: {
      plan: events.plan,
      /** "enterprise": the plan and the event count are the enterprise's, shared by its organizations */
      planScope: events.scope.entityType,
      status: subscription?.status ?? "ACTIVE",
      period: { start: monthStart.toISOString(), end: monthEnd.toISOString() },
      subscriptionPeriod: subscription
        ? { start: subscription.currentPeriodStart.toISOString(), end: subscription.currentPeriodEnd.toISOString() }
        : null,
      usage: [
        {
          key: "events",
          label: "Events this month",
          used: events.used,
          limit: events.limit,
          resetsAt: events.resetsAt.toISOString(),
          note: sharedWithEnterprise
            ? `Resets on ${formatResetDate(events.resetsAt)}. Shared by every organization in your enterprise. Cancelled and deleted events don't count.`
            : `Resets on ${formatResetDate(events.resetsAt)}. Cancelled and deleted events don't count.`,
          // Set when one more event would go over the limit: what the create button will say.
          ...(events.allowed ? {} : { blocked: true, message: events.message }),
        },
        { key: "teamMembers", label: "Team members", used: memberCount, limit: limits.maxTeamMembers },
        {
          key: "participantsPerEvent",
          label: "Participants per event",
          used: top?._count._all ?? 0,
          limit: limits.maxParticipantsPerEvent,
          note: topEvent ? `Busiest upcoming event: ${topEvent.title}` : "No upcoming events with registrations",
        },
      ],
    },
  })
}
