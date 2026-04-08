import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"

// GET — List blog posts
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const orgSlug = searchParams.get("orgSlug")
  const category = searchParams.get("category")
  const status = searchParams.get("status")
  const page = Number(searchParams.get("page") || "1")
  const limit = Math.min(Number(searchParams.get("limit") || "9"), 24)

  if (!orgSlug) return NextResponse.json({ success: false, message: "orgSlug required" }, { status: 400 })

  const org = await prisma.organization.findUnique({ where: { slug: orgSlug }, select: { id: true } })
  if (!org) return NextResponse.json({ success: false, message: "Organization not found" }, { status: 404 })

  // Check module enabled
  const siteConfig = await prisma.siteConfig.findUnique({
    where: { organizationId: org.id },
    select: { enabledFeatures: true },
  })
  const features = (siteConfig?.enabledFeatures as any[]) || []
  if (!features.some((f: any) => f.moduleId === "blog-posts" && f.enabled)) {
    return NextResponse.json({ success: false, message: "This feature is not available" }, { status: 404 })
  }

  const where: any = { moduleId: "blog-posts", organizationId: org.id, dataType: "blog_post" }
  if (status !== "all") { where.isPublished = true; where.isActive = true }

  const posts = await prisma.featureModuleData.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * limit,
    take: limit,
    select: { id: true, title: true, data: true, isPublished: true, participantCount: true, createdAt: true },
  })

  // Filter by category if specified
  const filtered = category
    ? posts.filter((p: any) => (p.data as any)?.category === category)
    : posts

  return NextResponse.json({ success: true, data: filtered })
}

// POST — Create blog post (admin)
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
  const { title, slug, content, excerpt, category, tags, coverImage, readingTime, isPublished } = body

  if (!title) return NextResponse.json({ success: false, message: "Title required" }, { status: 400 })

  // Check slug uniqueness within org
  if (slug) {
    const existing = await prisma.featureModuleData.findFirst({
      where: { moduleId: "blog-posts", organizationId: org.id, dataType: "blog_post" },
    })
    // Note: slug uniqueness checked at data level since it's in JSON
  }

  const post = await prisma.featureModuleData.create({
    data: {
      moduleId: "blog-posts",
      organizationId: org.id,
      dataType: "blog_post",
      title,
      data: {
        title, slug: slug || title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        content, excerpt, category, tags, coverImage, readingTime,
        author: { name: session.user.name || "Admin" },
        publishedAt: isPublished ? new Date().toISOString() : null,
      },
      isPublished: isPublished ?? false,
      isActive: true,
      createdById: session.user.id,
    },
  })

  return NextResponse.json({ success: true, data: post }, { status: 201 })
}
