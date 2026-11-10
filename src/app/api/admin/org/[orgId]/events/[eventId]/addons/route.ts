import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { z } from "zod/v4"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"
import { mergeEventSettings, settingsObject, wizardSettingsSchema } from "@/lib/event-update"

// Add-ons are stored in the event's settings JSON field
// Structure: settings.addons = [{ name, price, maxQuantity, category }]

const putSchema = z.object({ addons: wizardSettingsSchema.shape.addons.unwrap().unwrap() })

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; eventId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  const { orgId, eventId } = await params

  const authResult = await authorize(session.user.id, PERMISSIONS.EVENT_VIEW, { organizationId: orgId })
  if (!authResult.authorized) return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })

  const event = await prisma.event.findFirst({
    where: { id: eventId, organizationId: orgId, deletedAt: null },
    select: { settings: true },
  })
  if (!event) return NextResponse.json({ success: false, message: "Event not found" }, { status: 404 })

  const addons = settingsObject(event.settings).addons
  return NextResponse.json({ success: true, data: Array.isArray(addons) ? addons : [] })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; eventId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  const { orgId, eventId } = await params

  const authResult = await authorize(session.user.id, PERMISSIONS.EVENT_EDIT, { organizationId: orgId })
  if (!authResult.authorized) return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })

  const parsed = putSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "Invalid add-ons" }, { status: 400 })
  }

  // Scoped lookup: another organization's event is not found (and never written).
  const event = await prisma.event.findFirst({
    where: { id: eventId, organizationId: orgId, deletedAt: null },
    select: { settings: true },
  })
  if (!event) return NextResponse.json({ success: false, message: "Event not found" }, { status: 404 })

  await prisma.event.update({
    where: { id: eventId },
    data: { settings: mergeEventSettings(event.settings, { addons: parsed.data.addons }) },
  })

  return NextResponse.json({ success: true, message: "Add-ons updated" })
}
