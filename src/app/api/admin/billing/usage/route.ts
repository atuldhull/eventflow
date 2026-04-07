import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { checkUsageLimits } from "@/lib/subscription"

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const entityType = request.nextUrl.searchParams.get("entityType") as "enterprise" | "org" || "org"
  const entityId = request.nextUrl.searchParams.get("entityId")

  if (!entityId) {
    return NextResponse.json({ success: false, message: "Entity ID required" }, { status: 400 })
  }

  const usage = await checkUsageLimits(entityType, entityId)
  return NextResponse.json({ success: true, data: usage })
}
