import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import type { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { createAuditLog, getClientInfo } from "@/lib/audit"
import { PERMISSIONS } from "@/lib/permissions"
import { firstIssue, organizationUpdateSchema } from "@/lib/enterprise-admin"

const ORG_SELECT = {
  id: true, name: true, slug: true, description: true, logo: true, website: true, email: true, phone: true,
  city: true, state: true, country: true, category: true, isVerified: true, isActive: true,
  primaryColor: true, secondaryColor: true, maxEvents: true, createdAt: true, updatedAt: true,
} as const

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string; orgId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { enterpriseId, orgId } = await params

  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_VIEW, { enterpriseId })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  const org = await prisma.organization.findFirst({
    where: { id: orgId, enterpriseId, deletedAt: null },
    select: ORG_SELECT,
  })

  if (!org) {
    return NextResponse.json({ success: false, message: "Organization not found" }, { status: 404 })
  }

  // ?include=details adds the stats, recent events and members the detail page shows.
  if (request.nextUrl.searchParams.get("include") !== "details") {
    return NextResponse.json({ success: true, data: org })
  }

  const canSeeRevenue = (await authorize(session.user.id, PERMISSIONS.PAYMENT_VIEW, { enterpriseId })).authorized
  const orgEvents: Prisma.EventWhereInput = { organizationId: orgId, deletedAt: null }

  const [eventCount, upcomingCount, memberCount, registrationCount, revenue, events, members] = await Promise.all([
    prisma.event.count({ where: orgEvents }),
    prisma.event.count({ where: { ...orgEvents, startDate: { gte: new Date() }, status: { notIn: ["CANCELLED", "DRAFT"] } } }),
    prisma.organizationMember.count({ where: { organizationId: orgId, isActive: true } }),
    prisma.registration.count({ where: { event: orgEvents } }),
    canSeeRevenue
      ? prisma.payment.aggregate({ where: { status: "COMPLETED", registration: { event: orgEvents } }, _sum: { amount: true } })
      : Promise.resolve(null),
    prisma.event.findMany({
      where: orgEvents,
      orderBy: { startDate: "desc" },
      take: 10,
      select: { id: true, title: true, status: true, startDate: true, currentRegistrations: true, maxCapacity: true, isPaid: true },
    }),
    prisma.organizationMember.findMany({
      where: { organizationId: orgId, isActive: true },
      orderBy: { joinedAt: "asc" },
      take: 10,
      select: { id: true, role: true, joinedAt: true, user: { select: { name: true, email: true } } },
    }),
  ])

  return NextResponse.json({
    success: true,
    data: {
      ...org,
      stats: {
        events: eventCount,
        upcomingEvents: upcomingCount,
        members: memberCount,
        registrations: registrationCount,
        revenue: revenue ? Number(revenue._sum.amount || 0) : null,
      },
      events: events.map((e) => ({ ...e, startDate: e.startDate.toISOString() })),
      members: members.map((m) => ({ id: m.id, role: m.role, joinedAt: m.joinedAt.toISOString(), name: m.user.name, email: m.user.email })),
    },
  })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string; orgId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { enterpriseId, orgId } = await params

  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_EDIT, { enterpriseId })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  const parsed = organizationUpdateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: firstIssue(parsed.error) }, { status: 400 })
  }

  try {
    const current = await prisma.organization.findFirst({
      where: { id: orgId, enterpriseId, deletedAt: null },
      select: ORG_SELECT,
    })
    if (!current) {
      return NextResponse.json({ success: false, message: "Organization not found" }, { status: 404 })
    }

    const updated = await prisma.organization.update({
      where: { id: orgId },
      data: parsed.data,
      select: ORG_SELECT,
    })

    const changed = Object.keys(parsed.data) as (keyof typeof parsed.data)[]
    const { ipAddress, userAgent } = getClientInfo(request)
    await createAuditLog({
      userId: session.user.id,
      action: "UPDATE",
      entityType: "ORGANIZATION",
      entityId: orgId,
      description:
        changed.length === 1 && changed[0] === "isActive"
          ? `${parsed.data.isActive ? "Activated" : "Deactivated"} organization: ${current.name}`
          : `Updated organization: ${updated.name}`,
      oldValues: Object.fromEntries(changed.map((k) => [k, current[k] ?? null])) as Prisma.InputJsonValue,
      newValues: parsed.data as Prisma.InputJsonValue,
      ipAddress,
      userAgent,
      enterpriseId,
      organizationId: orgId,
    })

    return NextResponse.json({ success: true, message: "Organization updated", data: updated })
  } catch (error) {
    console.error("Update org error:", error)
    return NextResponse.json({ success: false, message: "Failed to update" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string; orgId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { enterpriseId, orgId } = await params

  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_DELETE, { enterpriseId })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  try {
    const org = await prisma.organization.findFirst({
      where: { id: orgId, enterpriseId, deletedAt: null },
      select: { name: true },
    })
    if (!org) {
      return NextResponse.json({ success: false, message: "Organization not found" }, { status: 404 })
    }

    await prisma.organization.update({
      where: { id: orgId },
      data: { deletedAt: new Date(), isActive: false },
    })

    const { ipAddress, userAgent } = getClientInfo(request)
    await createAuditLog({
      userId: session.user.id,
      action: "DELETE",
      entityType: "ORGANIZATION",
      entityId: orgId,
      description: `Deleted organization: ${org.name}`,
      ipAddress,
      userAgent,
      enterpriseId,
      organizationId: orgId,
    })

    return NextResponse.json({ success: true, message: "Organization deleted" })
  } catch (error) {
    console.error("Delete org error:", error)
    return NextResponse.json({ success: false, message: "Failed to delete" }, { status: 500 })
  }
}
