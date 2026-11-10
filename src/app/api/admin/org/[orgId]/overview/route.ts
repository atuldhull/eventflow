import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import type { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS, getRolePermissions } from "@/lib/permissions"
import { hasActiveHold } from "@/lib/registration-capacity"
import { NOT_REVOKED_CERTIFICATE_WHERE } from "@/lib/certificate-verification"

const ACTIVE_EVENT_STATUSES = ["PUBLISHED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "ONGOING"]
const INACTIVE_REGISTRATION = ["CANCELLED", "REJECTED"] as const

interface PendingAction { key: string; label: string; count: number; href: string }
interface ActivityItem { id: string; action: string; entityType: string; description: string; actor: string | null; createdAt: string; href: string | null }

/**
 * The organization overview (/admin/org): headline numbers, pending actions and recent
 * activity, everything scoped to this organization. Parts the caller's role may not see
 * (revenue, approvals, certificates, the audit log) are left out rather than refused.
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
  const authResult = await authorize(session.user.id, PERMISSIONS.EVENT_VIEW, { organizationId: orgId })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }
  const perms = new Set(authResult.role ? getRolePermissions(authResult.role) : [])
  const can = (p: (typeof PERMISSIONS)[keyof typeof PERMISSIONS]) => perms.has(p)

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const events: Prisma.EventWhereInput = { organizationId: orgId, deletedAt: null }
  const liveRegistrations: Prisma.RegistrationWhereInput = { event: events, status: { notIn: [...INACTIVE_REGISTRATION] } }

  const [eventsByStatus, registrationTotal, registrationsThisMonth, teamMembers, upcoming] = await Promise.all([
    prisma.event.groupBy({ by: ["status"], where: events, _count: true }),
    prisma.registration.count({ where: liveRegistrations }),
    prisma.registration.count({ where: { ...liveRegistrations, createdAt: { gte: monthStart } } }),
    prisma.organizationMember.count({ where: { organizationId: orgId, isActive: true } }),
    prisma.event.findMany({
      where: { ...events, endDate: { gte: now }, status: { notIn: ["CANCELLED", "COMPLETED"] } },
      orderBy: { startDate: "asc" },
      take: 5,
      select: { id: true, title: true, status: true, category: true, startDate: true, endDate: true, timezone: true, currentRegistrations: true, maxCapacity: true },
    }),
  ])
  const countOf = (...statuses: string[]) =>
    eventsByStatus.filter((e) => statuses.includes(e.status)).reduce((n, e) => n + e._count, 0)

  // Revenue this calendar month: completed payments for this organization's events, by
  // when they were paid (creation time for older rows without paidAt).
  let revenueThisMonth: number | null = null
  let paymentsThisMonth: number | null = null
  if (can(PERMISSIONS.PAYMENT_VIEW)) {
    const sum = await prisma.payment.aggregate({
      where: {
        status: "COMPLETED",
        event: events,
        OR: [{ paidAt: { gte: monthStart } }, { paidAt: null, createdAt: { gte: monthStart } }],
      },
      _sum: { amount: true },
      _count: true,
    })
    revenueThisMonth = Number(sum._sum.amount ?? 0)
    paymentsThisMonth = sum._count
  }

  const pendingActions: PendingAction[] = []
  if (can(PERMISSIONS.REGISTRATION_APPROVE)) {
    // PENDING covers both "awaiting the organizer" and "holding a seat during checkout";
    // only the first needs anyone's action.
    const pending = await prisma.registration.findMany({
      where: { event: events, status: "PENDING" },
      select: { status: true, metadata: true },
      take: 2000,
    })
    const awaiting = pending.filter((r) => !hasActiveHold(r)).length
    if (awaiting > 0) {
      pendingActions.push({ key: "approvals", label: `${awaiting} registration${awaiting === 1 ? "" : "s"} awaiting approval`, count: awaiting, href: "/admin/org/registrations?status=PENDING" })
    }
  }
  if (can(PERMISSIONS.EVENT_PUBLISH)) {
    const drafts = countOf("DRAFT")
    if (drafts > 0) pendingActions.push({ key: "drafts", label: `${drafts} draft event${drafts === 1 ? "" : "s"} to publish`, count: drafts, href: "/admin/org/events?status=DRAFT" })
    const review = countOf("PENDING_APPROVAL")
    if (review > 0) pendingActions.push({ key: "review", label: `${review} event${review === 1 ? "" : "s"} awaiting review`, count: review, href: "/admin/org/events?status=PENDING_APPROVAL" })
  }
  if (can(PERMISSIONS.CERTIFICATE_GENERATE)) {
    const [ready, unissued] = await Promise.all([
      prisma.certificate.count({ where: { status: "GENERATED", event: events, ...NOT_REVOKED_CERTIFICATE_WHERE } }),
      prisma.event.count({
        where: { ...events, status: "COMPLETED", certificates: { none: {} }, registrations: { some: { status: "CHECKED_IN" } } },
      }),
    ])
    if (ready > 0) pendingActions.push({ key: "certificates", label: `${ready} certificate${ready === 1 ? "" : "s"} ready to send`, count: ready, href: "/admin/org/certificates" })
    if (unissued > 0) pendingActions.push({ key: "certificates-missing", label: `${unissued} finished event${unissued === 1 ? "" : "s"} without certificates`, count: unissued, href: "/admin/org/certificates" })
  }

  // Recent activity: the organization's audit trail when the caller may read it,
  // otherwise its latest registrations.
  let recentActivity: ActivityItem[] = []
  if (can(PERMISSIONS.AUDIT_VIEW)) {
    const logs = await prisma.auditLog.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, action: true, entityType: true, entityId: true, description: true, createdAt: true, user: { select: { name: true } } },
    })
    recentActivity = logs.map((l) => ({
      id: l.id,
      action: l.action,
      entityType: l.entityType,
      description: l.description || `${l.action.toLowerCase()} ${l.entityType.toLowerCase()}`,
      actor: l.user?.name ?? null,
      createdAt: l.createdAt.toISOString(),
      href: l.entityType === "EVENT" && l.action !== "DELETE" ? `/admin/org/events/${l.entityId}` : null,
    }))
  } else if (can(PERMISSIONS.REGISTRATION_VIEW)) {
    const regs = await prisma.registration.findMany({
      where: { event: events },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, status: true, createdAt: true, eventId: true, user: { select: { name: true } }, event: { select: { title: true } } },
    })
    recentActivity = regs.map((r) => ({
      id: r.id,
      action: "CREATE",
      entityType: "REGISTRATION",
      description: `Registered for ${r.event.title}`,
      actor: r.user.name,
      createdAt: r.createdAt.toISOString(),
      href: `/admin/org/events/${r.eventId}/registrations`,
    }))
  }

  return NextResponse.json({
    success: true,
    data: {
      events: { total: eventsByStatus.reduce((n, e) => n + e._count, 0), active: countOf(...ACTIVE_EVENT_STATUSES), draft: countOf("DRAFT") },
      registrations: { total: registrationTotal, thisMonth: registrationsThisMonth },
      revenueThisMonth,
      paymentsThisMonth,
      teamMembers,
      pendingActions,
      recentActivity,
      upcomingEvents: upcoming.map((e) => ({ ...e, startDate: e.startDate.toISOString(), endDate: e.endDate.toISOString() })),
    },
  })
}
