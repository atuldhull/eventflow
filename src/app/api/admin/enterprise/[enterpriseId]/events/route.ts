import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { enterpriseId } = await params

  const authResult = await authorize(session.user.id, PERMISSIONS.EVENT_VIEW, { enterpriseId })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  const searchParams = request.nextUrl.searchParams
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "10")
  const search = searchParams.get("search") || ""
  const status = searchParams.get("status") || ""

  const where: Record<string, unknown> = {
    deletedAt: null,
    OR: [
      { enterpriseId },
      { organization: { enterpriseId } },
    ],
  }
  if (search) {
    where.title = { contains: search, mode: "insensitive" }
  }
  if (status) {
    where.status = status
  }

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where: where as any,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        title: true,
        slug: true,
        category: true,
        status: true,
        type: true,
        startDate: true,
        endDate: true,
        currentRegistrations: true,
        maxCapacity: true,
        isPaid: true,
        isFeatured: true,
        organization: { select: { name: true } },
      },
    }),
    prisma.event.count({ where: where as any }),
  ])

  return NextResponse.json({
    success: true,
    data: events.map((e) => ({
      ...e,
      organization: e.organization?.name || "Direct",
      startDate: e.startDate.toISOString(),
      endDate: e.endDate.toISOString(),
    })),
    pagination: { page, pageSize: limit, total, totalPages: Math.ceil(total / limit) },
  })
}
