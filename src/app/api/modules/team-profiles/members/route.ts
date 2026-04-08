import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"

async function resolveOrg(orgSlug: string) {
  return prisma.organization.findUnique({ where: { slug: orgSlug }, select: { id: true } })
}

async function checkModuleEnabled(orgId: string) {
  const siteConfig = await prisma.siteConfig.findUnique({
    where: { organizationId: orgId },
    select: { enabledFeatures: true },
  })
  const features = (siteConfig?.enabledFeatures as any[]) || []
  return features.some((f: any) => f.moduleId === "team-profiles" && f.enabled)
}

// GET — List team members
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const orgSlug = searchParams.get("orgSlug")
  const status = searchParams.get("status")

  if (!orgSlug) return NextResponse.json({ success: false, message: "orgSlug required" }, { status: 400 })

  const org = await resolveOrg(orgSlug)
  if (!org) return NextResponse.json({ success: false, message: "Organization not found" }, { status: 404 })

  if (!(await checkModuleEnabled(org.id))) {
    return NextResponse.json({ success: false, message: "This feature is not available" }, { status: 404 })
  }

  const where: any = { moduleId: "team-profiles", organizationId: org.id, dataType: "team_member_profile" }
  if (status !== "all") { where.isActive = true }

  const members = await prisma.featureModuleData.findMany({
    where,
    orderBy: { sortOrder: "asc" },
    select: { id: true, title: true, data: true, sortOrder: true, isActive: true, createdAt: true },
  })

  return NextResponse.json({ success: true, data: members })
}

// POST — Add team member (admin)
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
  if (!body.name || !body.role) return NextResponse.json({ success: false, message: "Name and role required" }, { status: 400 })

  const member = await prisma.featureModuleData.create({
    data: {
      moduleId: "team-profiles",
      organizationId: org.id,
      dataType: "team_member_profile",
      title: body.name,
      data: body,
      isActive: true,
      isPublished: true,
      createdById: session.user.id,
    },
  })

  return NextResponse.json({ success: true, data: member }, { status: 201 })
}

// PATCH — Update team member (admin)
export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })

  const { searchParams } = req.nextUrl
  const orgSlug = searchParams.get("orgSlug")
  const memberId = searchParams.get("memberId")
  if (!orgSlug || !memberId) return NextResponse.json({ success: false, message: "Missing params" }, { status: 400 })

  const org = await resolveOrg(orgSlug)
  if (!org) return NextResponse.json({ success: false, message: "Organization not found" }, { status: 404 })

  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_EDIT, { organizationId: org.id })
  if (!authResult.authorized) return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })

  const item = await prisma.featureModuleData.findUnique({ where: { id: memberId } })
  if (!item || item.organizationId !== org.id) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 })

  const body = await req.json()
  await prisma.featureModuleData.update({
    where: { id: memberId },
    data: { title: body.name || item.title, data: body, updatedById: session.user.id },
  })

  return NextResponse.json({ success: true })
}

// DELETE — Remove team member (admin)
export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })

  const { searchParams } = req.nextUrl
  const orgSlug = searchParams.get("orgSlug")
  const memberId = searchParams.get("memberId")
  if (!orgSlug || !memberId) return NextResponse.json({ success: false, message: "Missing params" }, { status: 400 })

  const org = await resolveOrg(orgSlug)
  if (!org) return NextResponse.json({ success: false, message: "Organization not found" }, { status: 404 })

  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_EDIT, { organizationId: org.id })
  if (!authResult.authorized) return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })

  const item = await prisma.featureModuleData.findUnique({ where: { id: memberId } })
  if (!item || item.organizationId !== org.id) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 })

  await prisma.featureModuleData.delete({ where: { id: memberId } })

  return NextResponse.json({ success: true })
}
