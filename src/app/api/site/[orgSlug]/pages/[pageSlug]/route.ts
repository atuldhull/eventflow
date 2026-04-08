import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

// GET — Fetch a custom page's sections (public, no auth)
export async function GET(req: NextRequest, { params }: { params: Promise<{ orgSlug: string; pageSlug: string }> }) {
  const { orgSlug, pageSlug } = await params

  const org = await prisma.organization.findUnique({ where: { slug: orgSlug }, select: { id: true } })
  if (!org) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 })

  const siteConfig = await prisma.siteConfig.findUnique({
    where: { organizationId: org.id },
    select: { id: true, isPublished: true },
  })
  if (!siteConfig || !siteConfig.isPublished) {
    return NextResponse.json({ success: false, message: "Not found" }, { status: 404 })
  }

  const page = await prisma.sitePage.findFirst({
    where: { siteConfigId: siteConfig.id, slug: pageSlug, isPublished: true },
    select: { title: true, slug: true, sections: true, seoTitle: true, seoDescription: true },
  })

  if (!page) return NextResponse.json({ success: false, message: "Page not found" }, { status: 404 })

  return NextResponse.json({
    success: true,
    page,
  }, { headers: { "Cache-Control": "public, max-age=120, stale-while-revalidate=300" } })
}
