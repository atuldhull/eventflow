import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"

// GET — Get current module configuration
export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string; moduleId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })

  const { orgId, moduleId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_VIEW, { organizationId: orgId })
  if (!authResult.authorized) return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })

  const [mod, siteConfig] = await Promise.all([
    prisma.featureModule.findUnique({ where: { moduleId } }),
    prisma.siteConfig.findUnique({ where: { organizationId: orgId }, select: { enabledFeatures: true } }),
  ])

  if (!mod) return NextResponse.json({ success: false, message: "Module not found" }, { status: 404 })

  const enabledFeatures = (siteConfig?.enabledFeatures as any[]) || []
  const entry = enabledFeatures.find((f: any) => f.moduleId === moduleId)

  return NextResponse.json({
    success: true,
    module: mod,
    config: entry?.config || mod.defaultConfig || {},
    placements: entry?.placements || [],
    isEnabled: entry?.enabled === true,
  })
}

// PATCH — Update module configuration
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ orgId: string; moduleId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })

  const { orgId, moduleId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_EDIT, { organizationId: orgId })
  if (!authResult.authorized) return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })

  const siteConfig = await prisma.siteConfig.findUnique({ where: { organizationId: orgId } })
  if (!siteConfig) return NextResponse.json({ success: false, message: "No website exists" }, { status: 404 })

  const body = await req.json()
  const { config, placements } = body

  const enabledFeatures = (siteConfig.enabledFeatures as any[]) || []
  const updatedFeatures = enabledFeatures.map((f: any) => {
    if (f.moduleId !== moduleId) return f
    return {
      ...f,
      ...(config !== undefined && { config }),
      ...(placements !== undefined && { placements }),
    }
  })

  await prisma.siteConfig.update({
    where: { organizationId: orgId },
    data: { enabledFeatures: updatedFeatures as any, lastEditedAt: new Date(), lastEditedBy: session.user.id },
  })

  return NextResponse.json({ success: true })
}
