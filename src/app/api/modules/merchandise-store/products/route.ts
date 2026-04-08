import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"

// Generic data management route for merchandise-store, sponsor-showcase, and team-profiles
// moduleId is determined by query param or defaults to "merchandise-store"

function getModuleId(searchParams: URLSearchParams) {
  return searchParams.get("moduleId") || "merchandise-store"
}

function getDataType(moduleId: string) {
  if (moduleId === "sponsor-showcase") return "sponsor_entry"
  if (moduleId === "team-profiles") return "team_member_profile"
  return "product"
}

// GET — List items
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const orgSlug = searchParams.get("orgSlug")
  const moduleId = getModuleId(searchParams)
  const status = searchParams.get("status")

  if (!orgSlug) return NextResponse.json({ success: false, message: "orgSlug required" }, { status: 400 })

  const org = await prisma.organization.findUnique({ where: { slug: orgSlug }, select: { id: true } })
  if (!org) return NextResponse.json({ success: false, message: "Organization not found" }, { status: 404 })

  const siteConfig = await prisma.siteConfig.findUnique({
    where: { organizationId: org.id },
    select: { enabledFeatures: true },
  })
  const features = (siteConfig?.enabledFeatures as any[]) || []
  if (!features.some((f: any) => f.moduleId === moduleId && f.enabled)) {
    return NextResponse.json({ success: false, message: "This feature is not available" }, { status: 404 })
  }

  const where: any = { moduleId, organizationId: org.id, dataType: getDataType(moduleId) }
  if (status !== "all") { where.isActive = true }

  const items = await prisma.featureModuleData.findMany({
    where,
    orderBy: { sortOrder: "asc" },
    select: { id: true, title: true, data: true, sortOrder: true, isActive: true, createdAt: true },
  })

  return NextResponse.json({ success: true, data: items })
}

// POST — Create item (admin)
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })

  const { searchParams } = req.nextUrl
  const orgSlug = searchParams.get("orgSlug")
  const moduleId = getModuleId(searchParams)
  if (!orgSlug) return NextResponse.json({ success: false, message: "orgSlug required" }, { status: 400 })

  const org = await prisma.organization.findUnique({ where: { slug: orgSlug }, select: { id: true } })
  if (!org) return NextResponse.json({ success: false, message: "Organization not found" }, { status: 404 })

  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_EDIT, { organizationId: org.id })
  if (!authResult.authorized) return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })

  const body = await req.json()
  const title = body.name || body.title || "Untitled"

  const item = await prisma.featureModuleData.create({
    data: {
      moduleId,
      organizationId: org.id,
      dataType: getDataType(moduleId),
      title,
      data: body,
      isActive: true,
      isPublished: true,
      createdById: session.user.id,
    },
  })

  return NextResponse.json({ success: true, data: item }, { status: 201 })
}

// PATCH — Update item (admin)
export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })

  const { searchParams } = req.nextUrl
  const orgSlug = searchParams.get("orgSlug")
  const productId = searchParams.get("productId")
  if (!orgSlug || !productId) return NextResponse.json({ success: false, message: "Missing params" }, { status: 400 })

  const org = await prisma.organization.findUnique({ where: { slug: orgSlug }, select: { id: true } })
  if (!org) return NextResponse.json({ success: false, message: "Organization not found" }, { status: 404 })

  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_EDIT, { organizationId: org.id })
  if (!authResult.authorized) return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })

  const body = await req.json()
  const item = await prisma.featureModuleData.findUnique({ where: { id: productId } })
  if (!item || item.organizationId !== org.id) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 })

  await prisma.featureModuleData.update({
    where: { id: productId },
    data: { title: body.name || body.title || item.title, data: body, updatedById: session.user.id },
  })

  return NextResponse.json({ success: true })
}

// DELETE — Delete item (admin)
export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })

  const { searchParams } = req.nextUrl
  const orgSlug = searchParams.get("orgSlug")
  const productId = searchParams.get("productId")
  if (!orgSlug || !productId) return NextResponse.json({ success: false, message: "Missing params" }, { status: 400 })

  const org = await prisma.organization.findUnique({ where: { slug: orgSlug }, select: { id: true } })
  if (!org) return NextResponse.json({ success: false, message: "Organization not found" }, { status: 404 })

  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_EDIT, { organizationId: org.id })
  if (!authResult.authorized) return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })

  const item = await prisma.featureModuleData.findUnique({ where: { id: productId } })
  if (!item || item.organizationId !== org.id) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 })

  await prisma.featureModuleData.delete({ where: { id: productId } })

  return NextResponse.json({ success: true })
}
