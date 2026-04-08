import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"

// POST — Disable a module (preserve data)
export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string; moduleId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })

  const { orgId, moduleId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_EDIT, { organizationId: orgId })
  if (!authResult.authorized) return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })

  const siteConfig = await prisma.siteConfig.findUnique({ where: { organizationId: orgId } })
  if (!siteConfig) return NextResponse.json({ success: false, message: "No website exists" }, { status: 404 })

  const enabledFeatures = (siteConfig.enabledFeatures as any[]) || []
  const updatedFeatures = enabledFeatures.map((f: any) =>
    f.moduleId === moduleId ? { ...f, enabled: false } : f
  )

  // Remove module sections from sections array
  const sections = (siteConfig.sections as any[]) || []
  const filteredSections = sections.filter((s: any) => !(s.type === "module-section" && s.config?.moduleId === moduleId))

  await prisma.siteConfig.update({
    where: { organizationId: orgId },
    data: {
      enabledFeatures: updatedFeatures as any,
      sections: filteredSections as any,
      lastEditedAt: new Date(),
      lastEditedBy: session.user.id,
    },
  })

  await prisma.featureModule.update({ where: { moduleId }, data: { installCount: { decrement: 1 } } })

  return NextResponse.json({ success: true, enabledFeatures: updatedFeatures })
}
