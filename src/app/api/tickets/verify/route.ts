import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { z } from "zod/v4"
import { auth } from "@/lib/auth"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"
import { validateTicketQR } from "@/lib/ticket"

const verifySchema = z.object({
  qrData: z.string().trim().min(1).max(4000),
  eventId: z.string().trim().min(1).max(64),
})

/**
 * Checks a scanned ticket without checking it in. Like the scanner itself, it works for
 * one event at a time and only for that event's door staff: the answer includes the
 * holder's name and email.
 */
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  try {
    const parsed = verifySchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: "QR data and event ID required" }, { status: 400 })
    }
    const { qrData, eventId } = parsed.data

    const authResult = await authorize(session.user.id, PERMISSIONS.CHECKIN_VIEW, { eventId })
    if (!authResult.authorized) {
      return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
    }

    const result = await validateTicketQR(qrData, { eventId })
    return NextResponse.json({ success: true, message: result.valid ? "Valid ticket" : result.message, data: result })
  } catch (error) {
    console.error("Ticket verification error:", error)
    return NextResponse.json({ success: false, message: "Verification failed" }, { status: 500 })
  }
}
