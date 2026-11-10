import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS, canManageEnterpriseRole, getAssignableEnterpriseRoles, hasPermission, getRolePermissions } from "@/lib/permissions"
import type { Role } from "@/lib/constants"
import { cleanSearch, enterpriseMemberWhere, parsePaging, type MemberStatus } from "@/lib/enterprise-admin"
import { readEnterprisePendingInvites } from "@/lib/enterprise-invites"
import { asObject } from "@/lib/org-settings"

const STATUSES = ["active", "inactive", "pending"] as const
type ListStatus = MemberStatus | "pending"

/**
 * The enterprise's memberships (`status=active|inactive`) or its pending invitations to
 * people without an account yet (`status=pending`). Invite / role change / removal stay on
 * /api/members/**, which enforce role rank and owner protection; `canManage` and `viewer`
 * here only mirror those rules (with the caller's role IN this enterprise, never their
 * global role) so the UI can hide actions that would be refused.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { enterpriseId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.MEMBER_VIEW, { enterpriseId })
  if (!authResult.authorized || !authResult.role) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  const sp = request.nextUrl.searchParams
  const { page, limit, skip } = parsePaging(sp, 10)
  const status: ListStatus = STATUSES.find((s) => s === sp.get("status")) ?? "active"
  const search = cleanSearch(sp.get("search"))

  const enterprise = await prisma.enterprise.findFirst({
    where: { id: enterpriseId, deletedAt: null },
    select: { ownerId: true, settings: true },
  })
  if (!enterprise) {
    return NextResponse.json({ success: false, message: "Enterprise not found" }, { status: 404 })
  }

  const callerRole = authResult.role as Role
  const callerIsOwner = enterprise.ownerId === session.user.id
  const callerPermissions = getRolePermissions(callerRole)
  const viewer = {
    role: callerRole,
    isOwner: callerIsOwner,
    canInvite: hasPermission(callerPermissions, PERMISSIONS.MEMBER_INVITE),
    assignableRoles: getAssignableEnterpriseRoles(callerRole, callerIsOwner),
  }

  const pending = readEnterprisePendingInvites(asObject(enterprise.settings))
  const [activeCount, inactiveCount] = await Promise.all([
    prisma.enterpriseMember.count({ where: enterpriseMemberWhere(enterpriseId, { status: "active" }) }),
    prisma.enterpriseMember.count({ where: enterpriseMemberWhere(enterpriseId, { status: "inactive" }) }),
  ])
  const counts = { active: activeCount, inactive: inactiveCount, pending: pending.length }

  if (status === "pending") {
    const needle = search.toLowerCase()
    const matching = needle ? pending.filter((i) => i.email.includes(needle)) : pending
    return NextResponse.json({
      success: true,
      data: matching.slice(skip, skip + limit).map((i) => ({
        email: i.email,
        role: i.role,
        invitedAt: i.invitedAt,
        invitedByName: i.invitedByName ?? null,
        // the same rank rule as sending it: only someone above the invited role can resend or withdraw it
        canManage: viewer.canInvite && canManageEnterpriseRole(callerRole, i.role as Role, callerIsOwner),
      })),
      counts,
      viewer,
      pagination: { page, pageSize: limit, total: matching.length, totalPages: Math.ceil(matching.length / limit) },
    })
  }

  const where = enterpriseMemberWhere(enterpriseId, { search, status })
  const [members, total] = await Promise.all([
    prisma.enterpriseMember.findMany({
      where,
      orderBy: [{ joinedAt: "desc" }],
      skip,
      take: limit,
      select: {
        id: true,
        role: true,
        isActive: true,
        joinedAt: true,
        updatedAt: true,
        user: { select: { id: true, name: true, email: true, lastLoginAt: true } },
      },
    }),
    prisma.enterpriseMember.count({ where }),
  ])

  return NextResponse.json({
    success: true,
    data: members.map((m) => {
      const isOwner = m.user.id === enterprise.ownerId
      const isSelf = m.user.id === session.user.id
      return {
        id: m.id,
        userId: m.user.id,
        name: m.user.name,
        email: m.user.email,
        role: m.role,
        isActive: m.isActive,
        joinedAt: m.joinedAt.toISOString(),
        updatedAt: m.updatedAt.toISOString(),
        lastLoginAt: m.user.lastLoginAt?.toISOString() ?? null,
        isOwner,
        isSelf,
        canManage: !isOwner && !isSelf && canManageEnterpriseRole(callerRole, m.role as Role, callerIsOwner),
      }
    }),
    counts,
    viewer,
    pagination: { page, pageSize: limit, total, totalPages: Math.ceil(total / limit) },
  })
}
