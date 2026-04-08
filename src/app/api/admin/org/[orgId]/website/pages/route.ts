import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"

// GET — List all custom pages
export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })

  const { orgId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_VIEW, { organizationId: orgId })
  if (!authResult.authorized) return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })

  const siteConfig = await prisma.siteConfig.findUnique({ where: { organizationId: orgId }, select: { id: true } })
  if (!siteConfig) return NextResponse.json({ success: true, data: [] })

  const pages = await prisma.sitePage.findMany({
    where: { siteConfigId: siteConfig.id },
    orderBy: { navOrder: "asc" },
    select: { id: true, title: true, slug: true, isPublished: true, showInNav: true, navOrder: true, createdAt: true },
  })

  return NextResponse.json({ success: true, data: pages })
}

// POST — Create a new custom page
export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })

  const { orgId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_EDIT, { organizationId: orgId })
  if (!authResult.authorized) return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })

  const siteConfig = await prisma.siteConfig.findUnique({ where: { organizationId: orgId }, select: { id: true } })
  if (!siteConfig) return NextResponse.json({ success: false, message: "No website exists" }, { status: 404 })

  const body = await req.json()
  const { title, slug, sections, showInNav } = body

  if (!title || !slug) return NextResponse.json({ success: false, message: "Title and slug required" }, { status: 400 })

  // Check slug uniqueness within this site
  const existing = await prisma.sitePage.findFirst({ where: { siteConfigId: siteConfig.id, slug } })
  if (existing) return NextResponse.json({ success: false, message: "A page with this slug already exists" }, { status: 409 })

  const pageCount = await prisma.sitePage.count({ where: { siteConfigId: siteConfig.id } })

  const page = await prisma.sitePage.create({
    data: {
      siteConfigId: siteConfig.id,
      title,
      slug,
      sections: sections || [],
      isPublished: true,
      showInNav: showInNav ?? true,
      navOrder: pageCount + 1,
    },
  })

  return NextResponse.json({ success: true, data: page }, { status: 201 })
}
