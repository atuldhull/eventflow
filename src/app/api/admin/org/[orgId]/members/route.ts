import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import type { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"
import { paginationMeta, parseEnumParam, parseListParams } from "@/lib/list-params"
import { readOrgSettings } from "@/lib/org-settings"
import { readPendingInvites } from "@/lib/org-invites"

const STATUSES = ["active", "removed", "pending"] as const

/**
 * The organization's team. `status=active|removed` lists memberships (with the user, the
 * role and how many of this organization's events they are on); `status=pending` lists
 * invitations sent to people without an account. Every list is scoped to this org.
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
  const authResult = await authorize(session.user.id, PERMISSIONS.MEMBER_VIEW, { organizationId: orgId })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  const searchParams = request.nextUrl.searchParams
  const { page, limit, skip, search } = parseListParams(searchParams, { defaultLimit: 10 })
  const status = parseEnumParam(searchParams, "status", STATUSES) ?? "active"

  const userSearch: Prisma.OrganizationMemberWhereInput = search
    ? {
        OR: [
          { user: { name: { contains: search, mode: "insensitive" } } },
          { user: { email: { contains: search, mode: "insensitive" } } },
        ],
      }
    : {}

  const settings = await readOrgSettings(orgId)
  const allPending = readPendingInvites(settings)
  const [activeCount, removedCount] = await Promise.all([
    prisma.organizationMember.count({ where: { organizationId: orgId, isActive: true } }),
    prisma.organizationMember.count({ where: { organizationId: orgId, isActive: false } }),
  ])
  const counts = { active: activeCount, removed: removedCount, pending: allPending.length }

  if (status === "pending") {
    const needle = search?.toLowerCase()
    const matching = needle ? allPending.filter((i) => i.email.includes(needle)) : allPending
    return NextResponse.json({
      success: true,
      data: matching.slice(skip, skip + limit).map((i) => ({
        email: i.email,
        role: i.role,
        invitedAt: i.invitedAt,
        invitedByName: i.invitedByName ?? null,
      })),
      counts,
      pagination: paginationMeta(page, limit, matching.length),
    })
  }

  const where: Prisma.OrganizationMemberWhereInput = {
    organizationId: orgId,
    isActive: status === "active",
    ...userSearch,
  }

  const [members, total] = await Promise.all([
    prisma.organizationMember.findMany({
      where,
      orderBy: { joinedAt: "desc" },
      skip,
      take: limit,
      include: { user: { select: { id: true, name: true, email: true, avatar: true, lastLoginAt: true } } },
    }),
    prisma.organizationMember.count({ where }),
  ])

  // how many of THIS organization's events each member is on the team of
  const assignments = members.length
    ? await prisma.eventTeamMember.groupBy({
        by: ["userId"],
        where: {
          userId: { in: members.map((m) => m.userId) },
          isActive: true,
          event: { organizationId: orgId, deletedAt: null },
        },
        _count: { _all: true },
      })
    : []
  const eventsByUser = new Map(assignments.map((a) => [a.userId, a._count._all]))

  return NextResponse.json({
    success: true,
    data: members.map((m) => ({
      id: m.id,
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      avatar: m.user.avatar,
      role: m.role,
      joinedAt: m.joinedAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
      lastLoginAt: m.user.lastLoginAt?.toISOString() ?? null,
      isActive: m.isActive,
      isSelf: m.userId === session.user.id,
      eventsAssigned: eventsByUser.get(m.userId) ?? 0,
    })),
    counts,
    pagination: paginationMeta(page, limit, total),
  })
}
