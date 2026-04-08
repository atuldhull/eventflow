import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"

// GET — Check where a media file is used
export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })

  const { orgId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_VIEW, { organizationId: orgId })
  if (!authResult.authorized) return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })

  const fileUrl = req.nextUrl.searchParams.get("fileUrl")
  if (!fileUrl) return NextResponse.json({ success: false, message: "fileUrl required" }, { status: 400 })

  const siteConfig = await prisma.siteConfig.findUnique({
    where: { organizationId: orgId },
    select: { id: true, sections: true, content: true, navigation: true, footer: true },
  })

  const usedIn: { location: string; sectionId?: string }[] = []

  if (siteConfig) {
    const sectionsStr = JSON.stringify(siteConfig.sections)
    if (sectionsStr.includes(fileUrl)) {
      const sections = (siteConfig.sections as any[]) || []
      sections.forEach((s: any) => {
        if (JSON.stringify(s).includes(fileUrl)) {
          const type = s.type?.replace(/-/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase())
          usedIn.push({ location: `${type} Section`, sectionId: s.id })
        }
      })
    }

    // Check pages too
    const pages = await prisma.sitePage.findMany({
      where: { siteConfigId: siteConfig.id },
      select: { title: true, sections: true },
    })
    pages.forEach((page) => {
      if (JSON.stringify(page.sections).includes(fileUrl)) {
        usedIn.push({ location: `Page: ${page.title}` })
      }
    })
  }

  return NextResponse.json({ success: true, usedIn, totalUsages: usedIn.length })
}
