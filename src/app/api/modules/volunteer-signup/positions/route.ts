import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"

// GET — List open volunteer positions
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const orgSlug = searchParams.get("orgSlug")
  const status = searchParams.get("status")

  if (!orgSlug) return NextResponse.json({ success: false, message: "orgSlug required" }, { status: 400 })

  const org = await prisma.organization.findUnique({ where: { slug: orgSlug }, select: { id: true } })
  if (!org) return NextResponse.json({ success: false, message: "Organization not found" }, { status: 404 })

  const siteConfig = await prisma.siteConfig.findUnique({
    where: { organizationId: org.id },
    select: { enabledFeatures: true },
  })
  const features = (siteConfig?.enabledFeatures as any[]) || []
  if (!features.some((f: any) => f.moduleId === "volunteer-signup" && f.enabled)) {
    return NextResponse.json({ success: false, message: "This feature is not available" }, { status: 404 })
  }

  const where: any = { moduleId: "volunteer-signup", organizationId: org.id, dataType: "volunteer_position" }
  if (status !== "all") { where.isActive = true }

  const positions = await prisma.featureModuleData.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, data: true, isActive: true, createdAt: true },
  })

  return NextResponse.json({ success: true, data: positions })
}

// POST — Create position (admin)
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })

  const { searchParams } = req.nextUrl
  const orgSlug = searchParams.get("orgSlug")
  if (!orgSlug) return NextResponse.json({ success: false, message: "orgSlug required" }, { status: 400 })

  const org = await prisma.organization.findUnique({ where: { slug: orgSlug }, select: { id: true } })
  if (!org) return NextResponse.json({ success: false, message: "Organization not found" }, { status: 404 })

  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_EDIT, { organizationId: org.id })
  if (!authResult.authorized) return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })

  const body = await req.json()
  const { title, description, event, timeCommitment, spotsTotal, skills, deadline } = body

  if (!title || !description) return NextResponse.json({ success: false, message: "Title and description required" }, { status: 400 })

  const position = await prisma.featureModuleData.create({
    data: {
      moduleId: "volunteer-signup",
      organizationId: org.id,
      dataType: "volunteer_position",
      title,
      data: { title, description, event, timeCommitment, spotsTotal: spotsTotal || 5, spotsFilled: 0, skills: skills || [], deadline },
      isActive: true,
      isPublished: true,
      createdById: session.user.id,
    },
  })

  return NextResponse.json({ success: true, data: position }, { status: 201 })
}

// PATCH — Update position
export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })

  const { searchParams } = req.nextUrl
  const orgSlug = searchParams.get("orgSlug")
  const positionId = searchParams.get("positionId")
  if (!orgSlug || !positionId) return NextResponse.json({ success: false, message: "Missing params" }, { status: 400 })

  const org = await prisma.organization.findUnique({ where: { slug: orgSlug }, select: { id: true } })
  if (!org) return NextResponse.json({ success: false, message: "Organization not found" }, { status: 404 })

  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_EDIT, { organizationId: org.id })
  if (!authResult.authorized) return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })

  const body = await req.json()
  const position = await prisma.featureModuleData.findUnique({ where: { id: positionId } })
  if (!position || position.organizationId !== org.id) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 })

  const existingData = position.data as any
  await prisma.featureModuleData.update({
    where: { id: positionId },
    data: { title: body.title || position.title, data: { ...existingData, ...body }, updatedById: session.user.id },
  })

  return NextResponse.json({ success: true })
}

// DELETE — Delete position
export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })

  const { searchParams } = req.nextUrl
  const orgSlug = searchParams.get("orgSlug")
  const positionId = searchParams.get("positionId")
  if (!orgSlug || !positionId) return NextResponse.json({ success: false, message: "Missing params" }, { status: 400 })

  const org = await prisma.organization.findUnique({ where: { slug: orgSlug }, select: { id: true } })
  if (!org) return NextResponse.json({ success: false, message: "Organization not found" }, { status: 404 })

  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_EDIT, { organizationId: org.id })
  if (!authResult.authorized) return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })

  await prisma.featureModuleData.delete({ where: { id: positionId } })

  return NextResponse.json({ success: true })
}
