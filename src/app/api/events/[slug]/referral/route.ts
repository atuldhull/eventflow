import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import prisma from "@/lib/prisma"

// Tracks referral clicks: /api/events/{slug}/referral?ref={code}
// The referral code is stored in cookies and attached to registration

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const ref = request.nextUrl.searchParams.get("ref")

  if (!ref) {
    return NextResponse.redirect(new URL(`/events/${slug}`, request.url))
  }

  // Redirect to event page with referral cookie
  const response = NextResponse.redirect(new URL(`/events/${slug}`, request.url))
  response.cookies.set("ef_ref", ref, {
    maxAge: 30 * 24 * 60 * 60, // 30 days
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  })

  return response
}
