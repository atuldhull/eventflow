import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { validateApiKey, checkScope } from "@/lib/api-keys"

interface ApiContext {
  apiKeyId: string
  organizationId?: string | null
  enterpriseId?: string | null
  scopes: string[]
}

type ApiHandler = (req: NextRequest, context: ApiContext, routeContext?: any) => Promise<NextResponse>

export function withApiAuth(requiredScope: string, handler: ApiHandler) {
  return async (req: NextRequest, routeContext?: any) => {
    const authHeader = req.headers.get("authorization")
    const apiKeyHeader = req.headers.get("x-api-key")
    const key = authHeader?.replace("Bearer ", "") || apiKeyHeader

    if (!key) {
      return NextResponse.json(
        { error: { code: "unauthorized", message: "API key required. Use Authorization: Bearer <key>" } },
        { status: 401, headers: { "X-Request-Id": crypto.randomUUID() } }
      )
    }

    const result = await validateApiKey(key)

    if (!result.valid || !result.apiKey) {
      return NextResponse.json(
        { error: { code: "unauthorized", message: result.error || "Invalid API key" } },
        { status: 401 }
      )
    }

    if (!checkScope(result.apiKey.scopes, requiredScope)) {
      return NextResponse.json(
        { error: { code: "forbidden", message: `Insufficient scope. Required: ${requiredScope}` } },
        { status: 403 }
      )
    }

    const response = await handler(req, {
      apiKeyId: result.apiKey.id,
      organizationId: result.apiKey.organizationId,
      enterpriseId: result.apiKey.enterpriseId,
      scopes: result.apiKey.scopes,
    }, routeContext)

    // Add rate limit headers
    response.headers.set("X-RateLimit-Limit", String(result.apiKey.rateLimit))
    response.headers.set("X-RateLimit-Remaining", String(Math.max(0, result.apiKey.rateLimit - (result.apiKey.requestCount + 1))))
    response.headers.set("X-Request-Id", crypto.randomUUID())

    return response
  }
}
