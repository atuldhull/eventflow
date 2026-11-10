import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { releaseExpiredHolds } from "@/lib/seat-hold"
import { SEAT_HOLD_MINUTES } from "@/lib/registration-capacity"

// Releases the seat holds of paid registrations whose payment wasn't completed within
// SEAT_HOLD_MINUTES: the event seat, ticket stock and coupon use go back, the
// registration is CANCELLED and its open payment FAILED.
//
// Scheduling: like /api/cron/reminders, this is called by an external scheduler
// (crontab, Vercel Cron, GitHub Actions, ...) with the CRON_SECRET bearer token; the repo
// has no built-in scheduler. Run it every 5 minutes, e.g. crontab:
//   */5 * * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/release-holds
// It is a backstop: POST /api/registrations also releases expired holds for the event
// it is about to check, and create-order releases the buyer's own expired hold.

const BATCH_SIZE = 500

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ success: false, message: "CRON_SECRET not configured" }, { status: 500 })
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  try {
    const { released, failed } = await releaseExpiredHolds({ limit: BATCH_SIZE })
    return NextResponse.json({
      success: true,
      message: `Released ${released} expired seat hold${released === 1 ? "" : "s"}`,
      data: { released, failed, holdMinutes: SEAT_HOLD_MINUTES },
    })
  } catch (error) {
    console.error("Seat hold release cron failed:", error)
    return NextResponse.json({ success: false, message: "Failed to release seat holds" }, { status: 500 })
  }
}
