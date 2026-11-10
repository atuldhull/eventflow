import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"
import { z } from "zod/v4"

// a module config is a small JSON object; cap its size so it can't bloat SiteConfig
const configSchema = z.object({
  config: z
    .record(z.string().max(100), z.unknown())
    .refine((c) => JSON.stringify(c).length <= 20_000, "Configuration is too large")
    .optional(),
  placements: z.array(z.string().max(60)).max(20).optional(),
})

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

  const parsed = configSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ success: false, message: "Validation failed" }, { status: 400 })
  const { config, placements } = parsed.data

  const mod = await prisma.featureModule.findUnique({ where: { moduleId }, select: { supportedPlacements: true } })
  if (!mod) return NextResponse.json({ success: false, message: "Module not found" }, { status: 404 })
  if (placements && placements.some((p) => !mod.supportedPlacements.includes(p))) {
    return NextResponse.json({ success: false, message: "This module can't be placed there" }, { status: 400 })
  }

  const enabledFeatures = (siteConfig.enabledFeatures as any[]) || []
  if (!enabledFeatures.some((f: any) => f.moduleId === moduleId)) {
    return NextResponse.json({ success: false, message: "Enable this module before configuring it" }, { status: 409 })
  }
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

  return NextResponse.json({ success: true, message: "Configuration saved" })
}
