import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"

// GET — List active polls for an org
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const orgSlug = searchParams.get("orgSlug")
  const status = searchParams.get("status")

  if (!orgSlug) {
    return NextResponse.json({ success: false, message: "orgSlug required" }, { status: 400 })
  }

  const org = await prisma.organization.findUnique({ where: { slug: orgSlug }, select: { id: true } })
  if (!org) {
    return NextResponse.json({ success: false, message: "Organization not found" }, { status: 404 })
  }

  // Check module enabled
  const siteConfig = await prisma.siteConfig.findUnique({
    where: { organizationId: org.id },
    select: { enabledFeatures: true },
  })
  const features = (siteConfig?.enabledFeatures as any[]) || []
  if (!features.some((f: any) => f.moduleId === "live-poll" && f.enabled)) {
    return NextResponse.json({ success: false, message: "This feature is not available" }, { status: 404 })
  }

  const where: any = {
    moduleId: "live-poll",
    organizationId: org.id,
    dataType: "poll_definition",
  }
  if (status !== "all") {
    where.isActive = true
    where.isPublished = true
  }

  const polls = await prisma.featureModuleData.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      data: true,
      isActive: true,
      isPublished: true,
      participantCount: true,
      createdAt: true,
    },
  })

  return NextResponse.json({ success: true, data: polls })
}

// POST — Create poll (admin)
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
  const { question, options } = body

  if (!question || !options?.length || options.length < 2) {
    return NextResponse.json({ success: false, message: "Question and at least 2 options required" }, { status: 400 })
  }

  const poll = await prisma.featureModuleData.create({
    data: {
      moduleId: "live-poll",
      organizationId: org.id,
      dataType: "poll_definition",
      title: question,
      data: {
        question,
        options: options.map((text: string) => ({ text, votes: 0 })),
      },
      isPublished: true,
      isActive: true,
      createdById: session.user.id,
    },
  })

  return NextResponse.json({ success: true, data: poll }, { status: 201 })
}
