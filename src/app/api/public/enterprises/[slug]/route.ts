import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { z } from "zod/v4"
import { PUBLIC_SLUG_PATTERN, getPublicEnterprise } from "@/lib/public-profiles"

const paramsSchema = z.object({ slug: z.string().trim().regex(PUBLIC_SLUG_PATTERN) })

/**
 * GET /api/public/enterprises/[slug]: an active enterprise's public profile (name,
 * logo, description, website, its organizations, PUBLIC events, counts). No contact details or
 * internal ids. 404 for an unknown, inactive or deleted enterprise.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const parsed = paramsSchema.safeParse(await params)
  const profile = parsed.success ? await getPublicEnterprise(parsed.data.slug) : null
  if (!profile) {
    return NextResponse.json({ success: false, message: "Enterprise not found" }, { status: 404 })
  }
  return NextResponse.json(
    { success: true, message: "OK", data: profile },
    { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } },
  )
}
