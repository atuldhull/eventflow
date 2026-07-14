import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"
import { getEntityPlan, isPlanSufficient } from "@/lib/subscription"

// GET — Get org's current website configuration
export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })

  const { orgId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_VIEW, { organizationId: orgId })
  if (!authResult.authorized) return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })

  const siteConfig = await prisma.siteConfig.findUnique({
    where: { organizationId: orgId },
    include: { template: { select: { id: true, name: true, slug: true, category: true, thumbnail: true } } },
  })

  if (!siteConfig) {
    return NextResponse.json({ success: true, exists: false })
  }

  return NextResponse.json({ success: true, exists: true, siteConfig, template: siteConfig.template })
}

// POST — Create website configuration (first time setup)
export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })

  const { orgId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_EDIT, { organizationId: orgId })
  if (!authResult.authorized) return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })

  // Check org doesn't already have a site config
  const existing = await prisma.siteConfig.findUnique({ where: { organizationId: orgId } })
  if (existing) {
    return NextResponse.json({ success: false, message: "Website already exists. Use PATCH to update." }, { status: 409 })
  }

  const body = await req.json()
  const { templateSlug } = body

  if (!templateSlug) return NextResponse.json({ success: false, message: "templateSlug required" }, { status: 400 })

  const template = await prisma.siteTemplate.findUnique({ where: { slug: templateSlug } })
  if (!template || !template.isActive) {
    return NextResponse.json({ success: false, message: "Template not found" }, { status: 404 })
  }

  const plan = await getEntityPlan("org", orgId)
  if (!isPlanSufficient(plan, template.requiredPlan)) {
    return NextResponse.json(
      { success: false, message: `The ${template.name} template requires the ${template.requiredPlan} plan. Upgrade to use it.` },
      { status: 402 }
    )
  }

  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { name: true, slug: true, description: true } })
  if (!org) return NextResponse.json({ success: false, message: "Organization not found" }, { status: 404 })

  const siteConfig = await prisma.siteConfig.create({
    data: {
      organizationId: orgId,
      templateId: template.id,
      siteName: org.name,
      tagline: org.description ? org.description.slice(0, 100) : null,
      siteDescription: org.description,
      sections: template.defaultSections as any,
      styles: template.defaultStyles as any,
      enabledFeatures: [],
      navigation: [
        { label: "Home", href: "/", order: 0 },
        { label: "Events", href: "#events", order: 1 },
        { label: "About", href: "#about", order: 2 },
        { label: "Contact", href: "#contact", order: 3 },
      ],
      footer: {
        columns: [],
        copyright: `© ${new Date().getFullYear()} ${org.name}. All rights reserved.`,
        showPoweredBy: true,
      },
      isPublished: false,
      seoTitle: org.name,
      seoDescription: org.description,
      lastEditedBy: session.user.id,
      lastEditedAt: new Date(),
    },
  })

  // Increment template install count
  await prisma.siteTemplate.update({ where: { id: template.id }, data: { installCount: { increment: 1 } } })

  return NextResponse.json({ success: true, siteConfig }, { status: 201 })
}

// PATCH — Update website configuration
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })

  const { orgId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_EDIT, { organizationId: orgId })
  if (!authResult.authorized) return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })

  const existing = await prisma.siteConfig.findUnique({ where: { organizationId: orgId } })
  if (!existing) return NextResponse.json({ success: false, message: "No website exists. Use POST to create." }, { status: 404 })

  const body = await req.json()
  const updateData: any = { lastEditedAt: new Date(), lastEditedBy: session.user.id }

  // Handle template change
  if (body.templateSlug && body.templateSlug !== undefined) {
    const newTemplate = await prisma.siteTemplate.findUnique({ where: { slug: body.templateSlug } })
    if (!newTemplate || !newTemplate.isActive) {
      return NextResponse.json({ success: false, message: "Template not found" }, { status: 404 })
    }

    const plan = await getEntityPlan("org", orgId)
    if (!isPlanSufficient(plan, newTemplate.requiredPlan)) {
      return NextResponse.json(
        { success: false, message: `The ${newTemplate.name} template requires the ${newTemplate.requiredPlan} plan. Upgrade to use it.` },
        { status: 402 }
      )
    }

    const oldSections = (existing.sections as any[]) || []
    const newSections = (newTemplate.defaultSections as any[]) || []

    // Content preservation: match sections by type and carry over content
    const preservedSections = newSections.map((newSec: any) => {
      const oldMatch = oldSections.find((os: any) => os.type === newSec.type)
      if (oldMatch && oldMatch.content) {
        return { ...newSec, content: { ...newSec.content, ...oldMatch.content } }
      }
      return newSec
    })

    updateData.templateId = newTemplate.id
    updateData.sections = preservedSections
    updateData.styles = newTemplate.defaultStyles

    // Update install counts
    await prisma.siteTemplate.update({ where: { id: existing.templateId }, data: { installCount: { decrement: 1 } } })
    await prisma.siteTemplate.update({ where: { id: newTemplate.id }, data: { installCount: { increment: 1 } } })
  }

  // Apply other field updates
  if (body.siteName !== undefined) updateData.siteName = body.siteName
  if (body.tagline !== undefined) updateData.tagline = body.tagline
  if (body.siteDescription !== undefined) updateData.siteDescription = body.siteDescription
  if (body.sections !== undefined) updateData.sections = body.sections
  if (body.styles !== undefined) updateData.styles = body.styles
  if (body.enabledFeatures !== undefined) updateData.enabledFeatures = body.enabledFeatures
  if (body.navigation !== undefined) updateData.navigation = body.navigation
  if (body.footer !== undefined) updateData.footer = body.footer
  if (body.isPublished !== undefined) updateData.isPublished = body.isPublished
  if (body.seoTitle !== undefined) updateData.seoTitle = body.seoTitle
  if (body.seoDescription !== undefined) updateData.seoDescription = body.seoDescription
  if (body.seoKeywords !== undefined) updateData.seoKeywords = body.seoKeywords
  if (body.customCss !== undefined) updateData.customCss = body.customCss
  if (body.favicon !== undefined) updateData.favicon = body.favicon
  if (body.ogImage !== undefined) updateData.ogImage = body.ogImage

  const updated = await prisma.siteConfig.update({ where: { organizationId: orgId }, data: updateData })

  return NextResponse.json({ success: true, siteConfig: updated })
}

// DELETE — Remove website configuration
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })

  const { orgId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_EDIT, { organizationId: orgId })
  if (!authResult.authorized) return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })

  const existing = await prisma.siteConfig.findUnique({ where: { organizationId: orgId } })
  if (!existing) return NextResponse.json({ success: false, message: "No website exists" }, { status: 404 })

  // Decrement template install count
  await prisma.siteTemplate.update({ where: { id: existing.templateId }, data: { installCount: { decrement: 1 } } })

  await prisma.siteConfig.delete({ where: { organizationId: orgId } })

  return NextResponse.json({ success: true })
}
