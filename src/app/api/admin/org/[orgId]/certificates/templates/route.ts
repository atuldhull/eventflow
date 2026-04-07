import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"
import { z } from "zod/v4"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { orgId } = await params
  const templates = await prisma.certificateTemplate.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { certificates: true } } },
  })

  return NextResponse.json({ success: true, data: templates })
}

const createTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  templateHtml: z.string().min(1),
  isDefault: z.boolean().default(false),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { orgId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.CERTIFICATE_CREATE_TEMPLATE, { organizationId: orgId })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  try {
    const body = await request.json()
    const parsed = createTemplateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: "Validation failed" }, { status: 400 })
    }

    // If setting as default, unset other defaults
    if (parsed.data.isDefault) {
      await prisma.certificateTemplate.updateMany({
        where: { organizationId: orgId, isDefault: true },
        data: { isDefault: false },
      })
    }

    const template = await prisma.certificateTemplate.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        templateHtml: parsed.data.templateHtml,
        isDefault: parsed.data.isDefault,
        organizationId: orgId,
        createdById: session.user.id,
      },
    })

    return NextResponse.json({ success: true, data: template }, { status: 201 })
  } catch (error) {
    console.error("Create template error:", error)
    return NextResponse.json({ success: false, message: "Failed to create template" }, { status: 500 })
  }
}
