import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"

// HEAD — quick "is this saved?" probe that matches client-side patterns of
// checking via HTTP status only. Returns 200 if saved, 404 if not.
export async function HEAD(_request: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return new NextResponse(null, { status: 401 })
  const { eventId } = await params
  const exists = await prisma.savedEvent.findUnique({
    where: { userId_eventId: { userId: session.user.id, eventId } },
    select: { id: true },
  })
  return new NextResponse(null, { status: exists ? 200 : 404 })
}

// GET — same info as HEAD but returns a JSON body
export async function GET(_request: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }
  const { eventId } = await params
  const exists = await prisma.savedEvent.findUnique({
    where: { userId_eventId: { userId: session.user.id, eventId } },
    select: { id: true, savedAt: true },
  })
  return NextResponse.json({ success: true, data: { saved: !!exists, savedAt: exists?.savedAt ?? null } })
}

// DELETE — unsave an event
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }
  const { eventId } = await params
  await prisma.savedEvent.deleteMany({
    where: { userId: session.user.id, eventId },
  })
  return NextResponse.json({ success: true, data: { saved: false } })
}
