import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"

async function resolveOrg(orgSlug: string) {
  const org = await prisma.organization.findUnique({ where: { slug: orgSlug }, select: { id: true } })
  return org
}

async function checkModuleEnabled(orgId: string, moduleId: string) {
  const siteConfig = await prisma.siteConfig.findUnique({
    where: { organizationId: orgId },
    select: { enabledFeatures: true },
  })
  const features = (siteConfig?.enabledFeatures as any[]) || []
  return features.some((f: any) => f.moduleId === moduleId && f.enabled)
}

// GET — List albums for an org (also handles sponsor-showcase and team-profiles data)
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const orgSlug = searchParams.get("orgSlug")
  const moduleId = searchParams.get("moduleId") || "photo-gallery"
  const status = searchParams.get("status")

  if (!orgSlug) return NextResponse.json({ success: false, message: "orgSlug required" }, { status: 400 })

  const org = await resolveOrg(orgSlug)
  if (!org) return NextResponse.json({ success: false, message: "Organization not found" }, { status: 404 })

  if (!(await checkModuleEnabled(org.id, moduleId))) {
    return NextResponse.json({ success: false, message: "This feature is not available" }, { status: 404 })
  }

  const dataType = moduleId === "sponsor-showcase" ? "sponsor_entry"
    : moduleId === "team-profiles" ? "team_member_profile"
    : "gallery_album"

  const where: any = { moduleId, organizationId: org.id, dataType }
  if (status !== "all") { where.isActive = true; where.isPublished = true }

  const items = await prisma.featureModuleData.findMany({
    where,
    orderBy: { sortOrder: "asc" },
    select: { id: true, title: true, data: true, sortOrder: true, isActive: true, isPublished: true, createdAt: true, participantCount: true },
  })

  return NextResponse.json({ success: true, data: items })
}

// POST — Create album (admin)
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })

  const { searchParams } = req.nextUrl
  const orgSlug = searchParams.get("orgSlug")
  if (!orgSlug) return NextResponse.json({ success: false, message: "orgSlug required" }, { status: 400 })

  const org = await resolveOrg(orgSlug)
  if (!org) return NextResponse.json({ success: false, message: "Organization not found" }, { status: 404 })

  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_EDIT, { organizationId: org.id })
  if (!authResult.authorized) return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })

  const body = await req.json()
  const { title, description } = body

  if (!title) return NextResponse.json({ success: false, message: "Title required" }, { status: 400 })

  const album = await prisma.featureModuleData.create({
    data: {
      moduleId: "photo-gallery",
      organizationId: org.id,
      dataType: "gallery_album",
      title,
      data: { title, description, coverUrl: "", photoCount: 0 },
      isPublished: true,
      isActive: true,
      createdById: session.user.id,
    },
  })

  return NextResponse.json({ success: true, data: album }, { status: 201 })
}

// PATCH — Update album
export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })

  const { searchParams } = req.nextUrl
  const orgSlug = searchParams.get("orgSlug")
  const albumId = searchParams.get("albumId")
  if (!orgSlug || !albumId) return NextResponse.json({ success: false, message: "orgSlug and albumId required" }, { status: 400 })

  const org = await resolveOrg(orgSlug)
  if (!org) return NextResponse.json({ success: false, message: "Organization not found" }, { status: 404 })

  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_EDIT, { organizationId: org.id })
  if (!authResult.authorized) return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })

  const body = await req.json()
  const album = await prisma.featureModuleData.findUnique({ where: { id: albumId } })
  if (!album || album.organizationId !== org.id) return NextResponse.json({ success: false, message: "Album not found" }, { status: 404 })

  const existingData = album.data as any
  await prisma.featureModuleData.update({
    where: { id: albumId },
    data: { title: body.title || album.title, data: { ...existingData, ...body }, updatedById: session.user.id },
  })

  return NextResponse.json({ success: true })
}

// DELETE — Delete album
export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })

  const { searchParams } = req.nextUrl
  const orgSlug = searchParams.get("orgSlug")
  const albumId = searchParams.get("albumId")
  if (!orgSlug || !albumId) return NextResponse.json({ success: false, message: "orgSlug and albumId required" }, { status: 400 })

  const org = await resolveOrg(orgSlug)
  if (!org) return NextResponse.json({ success: false, message: "Organization not found" }, { status: 404 })

  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_EDIT, { organizationId: org.id })
  if (!authResult.authorized) return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })

  await prisma.featureModuleData.delete({ where: { id: albumId } })
  // Also delete photos in this album
  await prisma.featureModuleData.deleteMany({
    where: { moduleId: "photo-gallery", organizationId: org.id, dataType: "gallery_photo", metadata: { path: ["albumId"], equals: albumId } },
  })

  return NextResponse.json({ success: true })
}
