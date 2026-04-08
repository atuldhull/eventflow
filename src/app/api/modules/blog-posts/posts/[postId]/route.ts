import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"

async function checkModuleEnabled(orgId: string) {
  const siteConfig = await prisma.siteConfig.findUnique({
    where: { organizationId: orgId },
    select: { enabledFeatures: true },
  })
  const features = (siteConfig?.enabledFeatures as any[]) || []
  return features.some((f: any) => f.moduleId === "blog-posts" && f.enabled)
}

// GET — Single post detail
export async function GET(req: NextRequest, { params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params

  const post = await prisma.featureModuleData.findUnique({
    where: { id: postId },
    select: { id: true, title: true, data: true, isPublished: true, participantCount: true, organizationId: true, createdAt: true },
  })

  if (!post) return NextResponse.json({ success: false, message: "Post not found" }, { status: 404 })

  if (post.organizationId && !(await checkModuleEnabled(post.organizationId))) {
    return NextResponse.json({ success: false, message: "This feature is not available" }, { status: 404 })
  }

  // Increment view count
  await prisma.featureModuleData.update({
    where: { id: postId },
    data: { participantCount: { increment: 1 }, lastActivityAt: new Date() },
  })

  return NextResponse.json({ success: true, data: post })
}

// PATCH — Update post (admin)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ postId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })

  const { postId } = await params
  const post = await prisma.featureModuleData.findUnique({ where: { id: postId }, select: { organizationId: true, data: true } })
  if (!post || !post.organizationId) return NextResponse.json({ success: false, message: "Post not found" }, { status: 404 })

  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_EDIT, { organizationId: post.organizationId })
  if (!authResult.authorized) return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })

  const body = await req.json()
  const existingData = post.data as any
  const { title, slug, content, excerpt, category, tags, coverImage, readingTime, isPublished } = body

  const updatedData = {
    ...existingData,
    ...(title !== undefined && { title }),
    ...(slug !== undefined && { slug }),
    ...(content !== undefined && { content }),
    ...(excerpt !== undefined && { excerpt }),
    ...(category !== undefined && { category }),
    ...(tags !== undefined && { tags }),
    ...(coverImage !== undefined && { coverImage }),
    ...(readingTime !== undefined && { readingTime }),
  }

  if (isPublished && !existingData.publishedAt) {
    updatedData.publishedAt = new Date().toISOString()
  }

  await prisma.featureModuleData.update({
    where: { id: postId },
    data: {
      title: title || undefined,
      data: updatedData,
      isPublished: isPublished ?? undefined,
      updatedById: session.user.id,
    },
  })

  return NextResponse.json({ success: true })
}

// DELETE — Delete post (admin)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ postId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })

  const { postId } = await params
  const post = await prisma.featureModuleData.findUnique({ where: { id: postId }, select: { organizationId: true } })
  if (!post || !post.organizationId) return NextResponse.json({ success: false, message: "Post not found" }, { status: 404 })

  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_EDIT, { organizationId: post.organizationId })
  if (!authResult.authorized) return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })

  await prisma.featureModuleData.delete({ where: { id: postId } })

  return NextResponse.json({ success: true })
}
