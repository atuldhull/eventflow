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
  return features.some((f: any) => f.moduleId === "sponsor-showcase" && f.enabled)
}

// GET — List sponsors for an org
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const orgSlug = searchParams.get("orgSlug")

  if (!orgSlug) return NextResponse.json({ success: false, message: "orgSlug required" }, { status: 400 })

  const org = await resolveOrg(orgSlug)
  if (!org) return NextResponse.json({ success: false, message: "Organization not found" }, { status: 404 })

  if (!(await checkModuleEnabled(org.id))) {
    return NextResponse.json({ success: false, message: "This feature is not available" }, { status: 404 })
  }

  const sponsors = await prisma.featureModuleData.findMany({
    where: { moduleId: "sponsor-showcase", organizationId: org.id, dataType: "sponsor_entry", isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, title: true, data: true, sortOrder: true, createdAt: true },
  })

  return NextResponse.json({ success: true, data: sponsors })
}

// POST — Add sponsor (admin)
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
  if (!body.name) return NextResponse.json({ success: false, message: "Sponsor name required" }, { status: 400 })

  const sponsor = await prisma.featureModuleData.create({
    data: {
      moduleId: "sponsor-showcase",
      organizationId: org.id,
      dataType: "sponsor_entry",
      title: body.name,
      data: body,
      isActive: true,
      isPublished: true,
      createdById: session.user.id,
    },
  })

  return NextResponse.json({ success: true, data: sponsor }, { status: 201 })
}

// PATCH — Update sponsor (admin)
export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })

  const { searchParams } = req.nextUrl
  const orgSlug = searchParams.get("orgSlug")
  const sponsorId = searchParams.get("sponsorId")
  if (!orgSlug || !sponsorId) return NextResponse.json({ success: false, message: "Missing params" }, { status: 400 })

  const org = await resolveOrg(orgSlug)
  if (!org) return NextResponse.json({ success: false, message: "Organization not found" }, { status: 404 })

  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_EDIT, { organizationId: org.id })
  if (!authResult.authorized) return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })

  const item = await prisma.featureModuleData.findUnique({ where: { id: sponsorId } })
  if (!item || item.organizationId !== org.id) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 })

  const body = await req.json()
  await prisma.featureModuleData.update({
    where: { id: sponsorId },
    data: { title: body.name || item.title, data: body, updatedById: session.user.id },
  })

  return NextResponse.json({ success: true })
}

// DELETE — Remove sponsor (admin)
export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })

  const { searchParams } = req.nextUrl
  const orgSlug = searchParams.get("orgSlug")
  const sponsorId = searchParams.get("sponsorId")
  if (!orgSlug || !sponsorId) return NextResponse.json({ success: false, message: "Missing params" }, { status: 400 })

  const org = await resolveOrg(orgSlug)
  if (!org) return NextResponse.json({ success: false, message: "Organization not found" }, { status: 404 })

  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_EDIT, { organizationId: org.id })
  if (!authResult.authorized) return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })

  const item = await prisma.featureModuleData.findUnique({ where: { id: sponsorId } })
  if (!item || item.organizationId !== org.id) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 })

  await prisma.featureModuleData.delete({ where: { id: sponsorId } })

  return NextResponse.json({ success: true })
}
