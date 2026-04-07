import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { validateApiKey, checkScope } from "@/lib/api-keys"
import { rateLimiter } from "@/lib/rate-limiter"

interface ApiContext {
  apiKeyId: string
  userId: string
  organizationId?: string | null
  enterpriseId?: string | null
  scopes: string[]
}

type ApiHandler = (req: NextRequest, context: ApiContext, routeContext?: any) => Promise<NextResponse>

export function withApiAuth(requiredScope: string, handler: ApiHandler) {
  return async (req: NextRequest, routeContext?: any) => {
    const requestId = crypto.randomUUID()
    const authHeader = req.headers.get("authorization")
    const apiKeyHeader = req.headers.get("x-api-key")
    const key = authHeader?.replace(/^Bearer\s+/i, "") || apiKeyHeader

    if (!key) {
      return NextResponse.json(
        { error: { code: "unauthorized", message: "API key required. Use Authorization: Bearer <key>" } },
        { status: 401, headers: { "X-Request-Id": requestId } }
      )
    }

    const result = await validateApiKey(key)

    if (!result.valid || !result.apiKey) {
      return NextResponse.json(
        { error: { code: "unauthorized", message: result.error || "Invalid API key" } },
        { status: 401, headers: { "X-Request-Id": requestId } }
      )
    }

    if (!checkScope(result.apiKey.scopes, requiredScope)) {
      return NextResponse.json(
        { error: { code: "forbidden", message: `Insufficient scope. Required: ${requiredScope}` } },
        { status: 403, headers: { "X-Request-Id": requestId } }
      )
    }

    // Enforce rate limiting per API key
    const rateLimit = result.apiKey.rateLimit || 100
    const rl = rateLimiter.check(`apikey:${result.apiKey.id}`, rateLimit, 60 * 1000)

    if (!rl.allowed) {
      return NextResponse.json(
        { error: { code: "rate_limited", message: "Too many requests. Try again later." } },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": String(rateLimit),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(Math.ceil(rl.resetAt / 1000)),
            "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
            "X-Request-Id": requestId,
          },
        }
      )
    }

    const response = await handler(req, {
      apiKeyId: result.apiKey.id,
      userId: result.apiKey.createdById || "",
      organizationId: result.apiKey.organizationId,
      enterpriseId: result.apiKey.enterpriseId,
      scopes: result.apiKey.scopes,
    }, routeContext)

    // Add rate limit headers
    response.headers.set("X-RateLimit-Limit", String(rateLimit))
    response.headers.set("X-RateLimit-Remaining", String(rl.remaining))
    response.headers.set("X-Request-Id", requestId)

    return response
  }
}
