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
  const authResult = await authorize(session.user.id, PERMISSIONS.MEMBER_VIEW, { organizationId: orgId })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  const searchParams = request.nextUrl.searchParams
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "10")
  const status = searchParams.get("status") || "active"

  const members = await prisma.organizationMember.findMany({
    where: { organizationId: orgId, isActive: status === "active" },
    orderBy: { joinedAt: "desc" },
    skip: (page - 1) * limit,
    take: limit,
    include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
  })

  const total = await prisma.organizationMember.count({
    where: { organizationId: orgId, isActive: status === "active" },
  })

  return NextResponse.json({
    success: true,
    data: members.map((m) => ({
      id: m.id,
      name: m.user.name,
      email: m.user.email,
      avatar: m.user.avatar,
      role: m.role,
      joinedAt: m.joinedAt.toISOString(),
      isActive: m.isActive,
    })),
    pagination: { page, pageSize: limit, total, totalPages: Math.ceil(total / limit) },
  })
}
