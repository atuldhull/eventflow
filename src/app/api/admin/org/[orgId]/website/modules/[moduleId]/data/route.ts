import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"

// GET — List module data entries
export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string; moduleId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })

  const { orgId, moduleId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_VIEW, { organizationId: orgId })
  if (!authResult.authorized) return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })

  const { searchParams } = req.nextUrl
  const dataType = searchParams.get("dataType")
  const page = Number(searchParams.get("page") || "1")
  const limit = Math.min(Number(searchParams.get("limit") || "20"), 50)

  const where: any = { moduleId, organizationId: orgId }
  if (dataType) where.dataType = dataType

  const [data, total] = await Promise.all([
    prisma.featureModuleData.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.featureModuleData.count({ where }),
  ])

  return NextResponse.json({ success: true, data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } })
}

// POST — Create a module data entry
export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string; moduleId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })

  const { orgId, moduleId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_EDIT, { organizationId: orgId })
  if (!authResult.authorized) return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })

  const body = await req.json()
  const { dataType, title, data, isPublished } = body

  if (!dataType) return NextResponse.json({ success: false, message: "dataType required" }, { status: 400 })

  const entry = await prisma.featureModuleData.create({
    data: {
      moduleId,
      organizationId: orgId,
      dataType,
      title: title || null,
      data: data || {},
      isPublished: isPublished ?? true,
      isActive: true,
      createdById: session.user.id,
    },
  })

  return NextResponse.json({ success: true, data: entry }, { status: 201 })
}
