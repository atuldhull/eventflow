import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { rateLimiter, RATE_LIMITS } from "@/lib/rate-limiter"
import { buildUserDataExport, exportFileName } from "@/lib/data-export"

// "Download my data": a JSON file of everything kept about the signed-in account.
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const limit = await rateLimiter.check(`data-export:${session.user.id}`, RATE_LIMITS.dataExport.limit, RATE_LIMITS.dataExport.windowMs)
  if (!limit.allowed) {
    return NextResponse.json(
      { success: false, message: "You have downloaded your data a few times already. Try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter ?? 3600) } }
    )
  }

  const now = new Date()
  const data = await buildUserDataExport(session.user.id, now)
  if (!data) {
    return NextResponse.json({ success: false, message: "Account not found" }, { status: 404 })
  }

  return new NextResponse(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFileName(now)}"`,
      "Cache-Control": "no-store",
    },
  })
}
