import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { eventId } = await request.json()
    if (!eventId) return new NextResponse(null, { status: 204 })

    // In production: increment view count in EventAnalytics table
    // For now: no-op to avoid blocking page loads
    // TODO: Implement actual view tracking with session deduplication

    return new NextResponse(null, { status: 204 })
  } catch {
    return new NextResponse(null, { status: 204 })
  }
}
