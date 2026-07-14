import { NextResponse } from "next/server"

// View tracking is not implemented. There is no model in the Prisma schema to
// record a view against (no EventAnalytics / EventView table, no view counter on
// Event), so this endpoint cannot store anything. It returns 501 rather than a
// success status so callers are not misled into thinking views are being counted.
// To implement: add a view model with a (eventId, sessionId, day) unique constraint
// for deduplication, then record here.
export async function POST() {
  return NextResponse.json(
    { success: false, message: "View tracking is not implemented" },
    { status: 501 }
  )
}
