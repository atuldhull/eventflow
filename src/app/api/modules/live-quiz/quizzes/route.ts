import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"

// GET — List quizzes for an org
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const orgSlug = searchParams.get("orgSlug")
  const status = searchParams.get("status") // "active" | "all"

  if (!orgSlug) {
    return NextResponse.json({ success: false, message: "orgSlug required" }, { status: 400 })
  }

  const org = await prisma.organization.findUnique({ where: { slug: orgSlug }, select: { id: true } })
  if (!org) {
    return NextResponse.json({ success: false, message: "Organization not found" }, { status: 404 })
  }

  // Check that live-quiz module is enabled
  const siteConfig = await prisma.siteConfig.findUnique({
    where: { organizationId: org.id },
    select: { enabledFeatures: true },
  })
  const enabledFeatures = (siteConfig?.enabledFeatures as any[]) || []
  const quizEnabled = enabledFeatures.some((f: any) => f.moduleId === "live-quiz" && f.enabled)
  if (!quizEnabled) {
    return NextResponse.json({ success: false, message: "This feature is not available" }, { status: 404 })
  }

  const where: any = {
    moduleId: "live-quiz",
    organizationId: org.id,
    dataType: "quiz_definition",
  }
  // Public users only see published quizzes
  if (status !== "all") {
    where.isPublished = true
    where.isActive = true
  }

  const quizzes = await prisma.featureModuleData.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      data: true,
      isPublished: true,
      isActive: true,
      participantCount: true,
      createdAt: true,
    },
  })

  return NextResponse.json({ success: true, data: quizzes })
}

// POST — Create a quiz (admin only)
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const orgSlug = searchParams.get("orgSlug")
  if (!orgSlug) {
    return NextResponse.json({ success: false, message: "orgSlug required" }, { status: 400 })
  }

  const org = await prisma.organization.findUnique({ where: { slug: orgSlug }, select: { id: true } })
  if (!org) {
    return NextResponse.json({ success: false, message: "Organization not found" }, { status: 404 })
  }

  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_EDIT, { organizationId: org.id })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  const body = await req.json()
  const { title, description, questions, settings } = body

  if (!title || !questions?.length) {
    return NextResponse.json({ success: false, message: "Title and questions required" }, { status: 400 })
  }

  const quiz = await prisma.featureModuleData.create({
    data: {
      moduleId: "live-quiz",
      organizationId: org.id,
      dataType: "quiz_definition",
      title,
      data: { title, description, questions, settings },
      isPublished: true,
      isActive: true,
      createdById: session.user.id,
    },
  })

  return NextResponse.json({ success: true, data: quiz }, { status: 201 })
}
