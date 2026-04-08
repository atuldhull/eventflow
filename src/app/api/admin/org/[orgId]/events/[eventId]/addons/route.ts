import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"

// Add-ons are stored in the event's settings JSON field
// Structure: settings.addons = [{ id, name, description, price, maxQuantity, category }]

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; eventId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  const { orgId, eventId } = await params

  const event = await prisma.event.findFirst({
    where: { id: eventId, organizationId: orgId },
    select: { settings: true },
  })

  const settings = event?.settings as any || {}
  return NextResponse.json({ success: true, data: settings.addons || [] })
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

  const { addons } = await request.json()

  const event = await prisma.event.findFirst({ where: { id: eventId, organizationId: orgId }, select: { settings: true } })
  const currentSettings = (event?.settings as any) || {}

  await prisma.event.update({
    where: { id: eventId },
    data: { settings: { ...currentSettings, addons } },
  })

  return NextResponse.json({ success: true, message: "Add-ons updated" })
}
