import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { auth } from "@/lib/auth"

// GET — List applications for a position (admin)
export async function GET(req: NextRequest, { params }: { params: Promise<{ positionId: string }> }) {
  const { positionId } = await params
  const { searchParams } = req.nextUrl
  const orgSlug = searchParams.get("orgSlug")

  if (!orgSlug) return NextResponse.json({ success: false, message: "orgSlug required" }, { status: 400 })

  const applications = await prisma.featureModuleData.findMany({
    where: {
      moduleId: "volunteer-signup",
      dataType: "volunteer_application",
      metadata: { path: ["positionId"], equals: positionId },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, data: true, createdAt: true },
  })

  return NextResponse.json({ success: true, data: applications })
}

// POST — Submit volunteer application
export async function POST(req: NextRequest, { params }: { params: Promise<{ positionId: string }> }) {
  const { positionId } = await params
  const session = await auth()
  const body = await req.json()
  const { name, email, phone, why, experience, orgSlug } = body

  if (!name || !email) {
    return NextResponse.json({ success: false, message: "Name and email required" }, { status: 400 })
  }

  // Check position exists and has spots
  const position = await prisma.featureModuleData.findUnique({
    where: { id: positionId },
    select: { id: true, data: true, organizationId: true, isActive: true },
  })

  if (!position || !position.isActive) {
    return NextResponse.json({ success: false, message: "Position not found or closed" }, { status: 404 })
  }

  const posData = position.data as any
  if (posData.spotsFilled >= posData.spotsTotal) {
    return NextResponse.json({ success: false, message: "No spots available" }, { status: 400 })
  }

  // Check module enabled
  if (position.organizationId) {
    const siteConfig = await prisma.siteConfig.findUnique({
      where: { organizationId: position.organizationId },
      select: { enabledFeatures: true },
    })
    const features = (siteConfig?.enabledFeatures as any[]) || []
    if (!features.some((f: any) => f.moduleId === "volunteer-signup" && f.enabled)) {
      return NextResponse.json({ success: false, message: "This feature is not available" }, { status: 404 })
    }

    // Check auto-confirmation config
    const moduleConfig = features.find((f: any) => f.moduleId === "volunteer-signup")?.config || {}
    const autoConfirm = moduleConfig.autoConfirmation || false

    const application = await prisma.featureModuleData.create({
      data: {
        moduleId: "volunteer-signup",
        organizationId: position.organizationId,
        dataType: "volunteer_application",
        title: `${name} — ${posData.title}`,
        data: {
          positionId,
          name, email, phone,
          why, experience,
          status: autoConfirm ? "accepted" : "pending",
          appliedAt: new Date().toISOString(),
        },
        metadata: { positionId },
        isActive: true,
        isPublished: true,
        createdById: session?.user?.id,
      },
    })

    // Increment spotsFilled
    await prisma.featureModuleData.update({
      where: { id: positionId },
      data: {
        data: { ...posData, spotsFilled: (posData.spotsFilled || 0) + 1 },
        participantCount: { increment: 1 },
        lastActivityAt: new Date(),
      },
    })

    return NextResponse.json({ success: true, data: application }, { status: 201 })
  }

  return NextResponse.json({ success: false, message: "Invalid position" }, { status: 400 })
}
