import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Tracks referral clicks: /api/events/{slug}/referral?ref={code}
// The referral code is stored in a cookie and attached to the registration.

/** A referral code: a short token. Anything else is ignored rather than stored. */
const REF_PATTERN = /^[A-Za-z0-9_-]{1,64}$/

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const ref = request.nextUrl.searchParams.get("ref")?.trim()
  const eventUrl = new URL(`/events/${encodeURIComponent(slug)}`, request.url)

  const response = NextResponse.redirect(eventUrl)
  if (ref && REF_PATTERN.test(ref)) {
    response.cookies.set("ef_ref", ref, {
      maxAge: 30 * 24 * 60 * 60, // 30 days
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    })
  }
  return response
}
