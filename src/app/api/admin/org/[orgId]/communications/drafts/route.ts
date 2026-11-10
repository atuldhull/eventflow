import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"
import { draftInputSchema, saveDraft } from "@/lib/org-communications"

/** Saves an email draft (a new one, or over the draft with the given id). */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { orgId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.COMMUNICATION_SEND_EMAIL, { organizationId: orgId })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  const parsed = draftInputSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message || "Validation failed" },
      { status: 400 }
    )
  }

  // a draft aimed at one event must name one of this organization's events
  const { recipientFilter } = parsed.data
  if (recipientFilter?.type === "by_event" && recipientFilter.eventId) {
    const event = await prisma.event.findFirst({
      where: { id: recipientFilter.eventId, organizationId: orgId, deletedAt: null },
      select: { id: true },
    })
    if (!event) return NextResponse.json({ success: false, message: "Event not found" }, { status: 404 })
  }

  const draft = await saveDraft(orgId, parsed.data, { id: session.user.id, name: session.user.name })
  if (!draft) return NextResponse.json({ success: false, message: "Organization not found" }, { status: 404 })

  return NextResponse.json({ success: true, message: "Draft saved", data: draft })
}
