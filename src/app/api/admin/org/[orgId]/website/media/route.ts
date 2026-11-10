import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"
import { isSafeMediaUrl } from "@/lib/safe-url"

// GET — List media files
export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })

  const { orgId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_VIEW, { organizationId: orgId })
  if (!authResult.authorized) return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })

  const siteConfig = await prisma.siteConfig.findUnique({ where: { organizationId: orgId }, select: { id: true } })
  if (!siteConfig) return NextResponse.json({ success: true, media: [], pagination: { page: 1, limit: 20, total: 0 } })

  const { searchParams } = req.nextUrl
  const folder = searchParams.get("folder")
  const search = searchParams.get("search")
  const fileType = searchParams.get("fileType")
  const sort = searchParams.get("sort") || "newest"
  const page = Number(searchParams.get("page") || "1")
  const limit = Math.min(Number(searchParams.get("limit") || "24"), 50)

  const where: any = { siteConfigId: siteConfig.id }
  if (folder && folder !== "all") where.folder = folder
  if (fileType && fileType !== "all") where.fileType = { startsWith: fileType }
  if (search) where.OR = [{ fileName: { contains: search, mode: "insensitive" } }, { tags: { has: search } }]

  const orderBy: any = sort === "oldest" ? { createdAt: "asc" } : sort === "name" ? { fileName: "asc" } : sort === "largest" ? { fileSize: "desc" } : sort === "smallest" ? { fileSize: "asc" } : { createdAt: "desc" }

  const [media, total, totalSizeResult] = await Promise.all([
    prisma.siteMedia.findMany({ where, orderBy, skip: (page - 1) * limit, take: limit }),
    prisma.siteMedia.count({ where: { siteConfigId: siteConfig.id } }),
    prisma.siteMedia.aggregate({ where: { siteConfigId: siteConfig.id }, _sum: { fileSize: true } }),
  ])

  // Get unique folders
  const folders = await prisma.siteMedia.findMany({
    where: { siteConfigId: siteConfig.id },
    select: { folder: true },
    distinct: ["folder"],
  })

  return NextResponse.json({
    success: true,
    media,
    folders: folders.map((f) => f.folder),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    totalSize: totalSizeResult._sum.fileSize || 0,
  })
}

// POST — Upload media file(s)
export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })

  const { orgId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_EDIT, { organizationId: orgId })
  if (!authResult.authorized) return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })

  const siteConfig = await prisma.siteConfig.findUnique({ where: { organizationId: orgId }, select: { id: true } })
  if (!siteConfig) return NextResponse.json({ success: false, message: "No website exists" }, { status: 404 })

  const body = await req.json()
  const { fileName, fileUrl, fileType, fileSize, altText, folder, tags, width, height } = body

  if (!fileName || !fileUrl) return NextResponse.json({ success: false, message: "fileName and fileUrl required" }, { status: 400 })
  // The URL ends up in src/href on the public site: only web links and our own uploads,
  // never javascript:, data: or other schemes.
  if (!isSafeMediaUrl(fileUrl)) {
    return NextResponse.json({ success: false, message: "Use an https:// link or upload the file" }, { status: 400 })
  }

  // Validate file type
  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/svg+xml", "image/gif", "video/mp4", "application/pdf"]
  if (fileType && !allowedTypes.some((t) => fileType.startsWith(t.split("/")[0]))) {
    return NextResponse.json({ success: false, message: "File type not allowed" }, { status: 400 })
  }

  // Validate file size (10MB)
  if (fileSize && fileSize > 10 * 1024 * 1024) {
    return NextResponse.json({ success: false, message: "File too large (max 10MB)" }, { status: 400 })
  }

  const media = await prisma.siteMedia.create({
    data: {
      siteConfigId: siteConfig.id,
      fileName: fileName.replace(/[^a-zA-Z0-9._-]/g, "_"),
      fileUrl,
      fileType: fileType || "image/jpeg",
      fileSize: fileSize || 0,
      altText: altText || null,
      folder: folder || "general",
      tags: tags || [],
      width: width || null,
      height: height || null,
      uploadedById: session.user.id,
    },
  })

  return NextResponse.json({ success: true, data: media }, { status: 201 })
}
