import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"

// GET — List all available modules with org's enable status
export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })

  const { orgId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_VIEW, { organizationId: orgId })
  if (!authResult.authorized) return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })

  const [allModules, siteConfig] = await Promise.all([
    prisma.featureModule.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.siteConfig.findUnique({ where: { organizationId: orgId }, select: { enabledFeatures: true } }),
  ])

  const enabledFeatures = (siteConfig?.enabledFeatures as any[]) || []

  // Get data counts per module
  const dataCounts = await prisma.featureModuleData.groupBy({
    by: ["moduleId"],
    where: { organizationId: orgId },
    _count: { id: true },
  })
  const dataCountMap = new Map(dataCounts.map((d) => [d.moduleId, d._count.id]))

  // Get last activity per module
  const lastActivities = await prisma.featureModuleData.groupBy({
    by: ["moduleId"],
    where: { organizationId: orgId },
    _max: { lastActivityAt: true, updatedAt: true },
  })
  const lastActivityMap = new Map(lastActivities.map((d) => [d.moduleId, d._max.lastActivityAt || d._max.updatedAt]))

  const modules = allModules.map((mod) => {
    const enabledEntry = enabledFeatures.find((f: any) => f.moduleId === mod.moduleId)
    return {
      ...mod,
      isEnabled: enabledEntry?.enabled === true,
      currentConfig: enabledEntry?.config || null,
      currentPlacements: enabledEntry?.placements || null,
      dataCount: dataCountMap.get(mod.moduleId) || 0,
      lastActivity: lastActivityMap.get(mod.moduleId) || null,
    }
  })

  return NextResponse.json({ success: true, modules })
}
