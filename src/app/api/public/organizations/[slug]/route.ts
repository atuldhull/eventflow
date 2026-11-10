import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { z } from "zod/v4"
import { PUBLIC_SLUG_PATTERN, getPublicOrganization } from "@/lib/public-profiles"

const paramsSchema = z.object({ slug: z.string().trim().regex(PUBLIC_SLUG_PATTERN) })

/**
 * GET /api/public/organizations/[slug]: an active organization's public profile (name,
 * logo, description, website, location, PUBLIC events, counts). No contact details or
 * internal ids. 404 for an unknown, inactive or deleted organization.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const parsed = paramsSchema.safeParse(await params)
  const profile = parsed.success ? await getPublicOrganization(parsed.data.slug) : null
  if (!profile) {
    return NextResponse.json({ success: false, message: "Organization not found" }, { status: 404 })
  }
  return NextResponse.json(
    { success: true, message: "OK", data: profile },
    { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } },
  )
}
