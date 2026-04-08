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
  return features.some((f: any) => f.moduleId === "live-quiz" && f.enabled)
}

// GET — Single quiz detail
export async function GET(req: NextRequest, { params }: { params: Promise<{ quizId: string }> }) {
  const { quizId } = await params

  const quiz = await prisma.featureModuleData.findUnique({
    where: { id: quizId },
    select: { id: true, title: true, data: true, isPublished: true, isActive: true, participantCount: true, organizationId: true, createdAt: true },
  })

  if (!quiz) {
    return NextResponse.json({ success: false, message: "Quiz not found" }, { status: 404 })
  }

  if (quiz.organizationId && !(await checkModuleEnabled(quiz.organizationId))) {
    return NextResponse.json({ success: false, message: "This feature is not available" }, { status: 404 })
  }

  return NextResponse.json({ success: true, data: quiz })
}

// PATCH — Update quiz (admin)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ quizId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { quizId } = await params
  const quiz = await prisma.featureModuleData.findUnique({
    where: { id: quizId },
    select: { organizationId: true },
  })

  if (!quiz || !quiz.organizationId) {
    return NextResponse.json({ success: false, message: "Quiz not found" }, { status: 404 })
  }

  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_EDIT, { organizationId: quiz.organizationId })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  const body = await req.json()
  const { title, description, questions, settings } = body

  const updated = await prisma.featureModuleData.update({
    where: { id: quizId },
    data: {
      title: title || undefined,
      data: { title, description, questions, settings },
      updatedById: session.user.id,
    },
  })

  return NextResponse.json({ success: true, data: updated })
}

// DELETE — Delete quiz (admin)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ quizId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { quizId } = await params
  const quiz = await prisma.featureModuleData.findUnique({
    where: { id: quizId },
    select: { organizationId: true },
  })

  if (!quiz || !quiz.organizationId) {
    return NextResponse.json({ success: false, message: "Quiz not found" }, { status: 404 })
  }

  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_EDIT, { organizationId: quiz.organizationId })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  await prisma.featureModuleData.delete({ where: { id: quizId } })

  return NextResponse.json({ success: true })
}
