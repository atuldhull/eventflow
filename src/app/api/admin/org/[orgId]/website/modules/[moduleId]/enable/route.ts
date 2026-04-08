import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"

// POST — Enable a module
export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string; moduleId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })

  const { orgId, moduleId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_EDIT, { organizationId: orgId })
  if (!authResult.authorized) return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })

  const mod = await prisma.featureModule.findUnique({ where: { moduleId } })
  if (!mod || !mod.isActive) return NextResponse.json({ success: false, message: "Module not found" }, { status: 404 })

  const siteConfig = await prisma.siteConfig.findUnique({ where: { organizationId: orgId } })
  if (!siteConfig) return NextResponse.json({ success: false, message: "No website exists" }, { status: 404 })

  const enabledFeatures = (siteConfig.enabledFeatures as any[]) || []

  // Check if already enabled
  const existing = enabledFeatures.find((f: any) => f.moduleId === moduleId)
  if (existing?.enabled) return NextResponse.json({ success: true, message: "Already enabled" })

  // Check incompatibilities
  const incompatible = mod.incompatibleWith || []
  const conflicts = enabledFeatures.filter((f: any) => f.enabled && incompatible.includes(f.moduleId))
  if (conflicts.length > 0) {
    return NextResponse.json({ success: false, message: `Conflicts with: ${conflicts.map((c: any) => c.moduleId).join(", ")}` }, { status: 409 })
  }

  // Update enabledFeatures
  let updatedFeatures: any[]
  if (existing) {
    updatedFeatures = enabledFeatures.map((f: any) => f.moduleId === moduleId ? { ...f, enabled: true } : f)
  } else {
    updatedFeatures = [...enabledFeatures, {
      moduleId,
      enabled: true,
      config: mod.defaultConfig || {},
      placements: mod.supportedPlacements?.[0] ? [mod.supportedPlacements[0]] : [],
    }]
  }

  await prisma.siteConfig.update({
    where: { organizationId: orgId },
    data: { enabledFeatures: updatedFeatures as any, lastEditedAt: new Date(), lastEditedBy: session.user.id },
  })

  await prisma.featureModule.update({ where: { moduleId }, data: { installCount: { increment: 1 } } })

  return NextResponse.json({ success: true, enabledFeatures: updatedFeatures })
}
