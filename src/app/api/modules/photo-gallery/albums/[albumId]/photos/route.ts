import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"

// GET — List photos in album (paginated)
export async function GET(req: NextRequest, { params }: { params: Promise<{ albumId: string }> }) {
  const { albumId } = await params
  const { searchParams } = req.nextUrl
  const orgSlug = searchParams.get("orgSlug")
  const page = Number(searchParams.get("page") || "1")
  const limit = Math.min(Number(searchParams.get("limit") || "20"), 50)

  if (!orgSlug) return NextResponse.json({ success: false, message: "orgSlug required" }, { status: 400 })

  const org = await prisma.organization.findUnique({ where: { slug: orgSlug }, select: { id: true } })
  if (!org) return NextResponse.json({ success: false, message: "Organization not found" }, { status: 404 })

  const photos = await prisma.featureModuleData.findMany({
    where: {
      moduleId: "photo-gallery",
      organizationId: org.id,
      dataType: "gallery_photo",
      isActive: true,
      metadata: { path: ["albumId"], equals: albumId },
    },
    orderBy: { sortOrder: "asc" },
    skip: (page - 1) * limit,
    take: limit,
    select: { id: true, data: true, sortOrder: true, createdAt: true },
  })

  return NextResponse.json({ success: true, data: photos })
}

// POST — Upload photo to album (admin or user if uploads allowed)
export async function POST(req: NextRequest, { params }: { params: Promise<{ albumId: string }> }) {
  const { albumId } = await params
  const session = await auth()
  const { searchParams } = req.nextUrl
  const orgSlug = searchParams.get("orgSlug")

  if (!orgSlug) return NextResponse.json({ success: false, message: "orgSlug required" }, { status: 400 })

  const org = await prisma.organization.findUnique({ where: { slug: orgSlug }, select: { id: true } })
  if (!org) return NextResponse.json({ success: false, message: "Organization not found" }, { status: 404 })

  // Check if album exists
  const album = await prisma.featureModuleData.findUnique({ where: { id: albumId } })
  if (!album || album.organizationId !== org.id) {
    return NextResponse.json({ success: false, message: "Album not found" }, { status: 404 })
  }

  const body = await req.json()
  const { url, caption } = body

  if (!url) return NextResponse.json({ success: false, message: "Photo URL required" }, { status: 400 })

  // Check if user is admin or if uploads are allowed
  const isAdmin = session?.user?.id
    ? (await authorize(session.user.id, PERMISSIONS.ORG_EDIT, { organizationId: org.id })).authorized
    : false

  // Get module config to check allowUploads
  const siteConfig = await prisma.siteConfig.findUnique({
    where: { organizationId: org.id },
    select: { enabledFeatures: true },
  })
  const features = (siteConfig?.enabledFeatures as any[]) || []
  const moduleConfig = features.find((f: any) => f.moduleId === "photo-gallery")?.config || {}

  if (!isAdmin && !moduleConfig.allowUploads) {
    return NextResponse.json({ success: false, message: "Uploads not allowed" }, { status: 403 })
  }

  const needsModeration = !isAdmin && moduleConfig.moderateUploads !== false
  const dataType = needsModeration ? "gallery_upload_pending" : "gallery_photo"

  const photo = await prisma.featureModuleData.create({
    data: {
      moduleId: "photo-gallery",
      organizationId: org.id,
      dataType,
      data: { url, caption, albumId, uploadedBy: session?.user?.name || "Anonymous" },
      metadata: { albumId },
      isPublished: !needsModeration,
      isActive: !needsModeration,
      createdById: session?.user?.id,
    },
  })

  // Update album photo count if not pending
  if (!needsModeration) {
    const albumData = album.data as any
    await prisma.featureModuleData.update({
      where: { id: albumId },
      data: { data: { ...albumData, photoCount: (albumData.photoCount || 0) + 1 } },
    })
  }

  return NextResponse.json({ success: true, data: photo, pending: needsModeration }, { status: 201 })
}
