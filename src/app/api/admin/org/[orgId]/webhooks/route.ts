import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"
import { createWebhookEndpoint } from "@/lib/webhooks"
import { z } from "zod/v4"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })

  const { orgId } = await params
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { organizationId: orgId },
    select: {
      id: true, url: true, description: true, events: true, isActive: true,
      failureCount: true, lastDeliveredAt: true, lastFailedAt: true, createdAt: true,
      _count: { select: { deliveries: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({ success: true, data: endpoints })
}

const createWebhookSchema = z.object({
  url: z.url("Must be a valid URL"),
  events: z.array(z.string()).min(1, "Select at least one event"),
  description: z.string().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })

  const { orgId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_MANAGE_SETTINGS, { organizationId: orgId })
  if (!authResult.authorized) return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })

  try {
    const body = await request.json()
    const parsed = createWebhookSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors }, { status: 400 })

    const endpoint = await createWebhookEndpoint({
      url: parsed.data.url,
      events: parsed.data.events,
      description: parsed.data.description,
      organizationId: orgId,
      createdById: session.user.id,
    })

    return NextResponse.json({ success: true, data: { id: endpoint.id, url: endpoint.url, secret: endpoint.secret, events: endpoint.events } }, { status: 201 })
  } catch (error) {
    console.error("Create webhook error:", error)
    return NextResponse.json({ success: false, message: "Failed to create webhook" }, { status: 500 })
  }
}
