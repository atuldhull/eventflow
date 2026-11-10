import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { z } from "zod/v4"
import { rateLimiter } from "@/lib/rate-limiter"
import { getClientInfo } from "@/lib/audit"
import { reportError } from "@/lib/error-reporting"

// Crashes in the browser (the error pages call this), forwarded to the same alerts as
// server errors. Anyone can call it, so it is size-capped and limited per IP.
const schema = z.object({
  message: z.string().max(500),
  stack: z.string().max(4000).optional(),
  digest: z.string().max(100).optional(),
  path: z.string().max(300).optional(),
})

export async function POST(request: NextRequest) {
  const { ipAddress, userAgent } = getClientInfo(request)
  if (!(await rateLimiter.check(`client-errors:${ipAddress}`, 10, 10 * 60 * 1000)).allowed) {
    return new NextResponse(null, { status: 429 })
  }
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return new NextResponse(null, { status: 400 })
  const { message, stack, digest, path } = parsed.data
  const err = new Error(message)
  err.name = "ClientError"
  if (stack) err.stack = stack
  await reportError(err, { where: `client: ${path ?? "?"}`, extra: { digest, userAgent: userAgent.slice(0, 200) } })
  return new NextResponse(null, { status: 204 })
}
