import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { handlers } from "@/lib/auth"
import { getActivePlatformSettings } from "@/lib/platform-settings-store"
import type { PlatformSettings } from "@/lib/platform-settings"

/** OAuth providers that Settings → Features can switch off (the signIn callback refuses them too). */
const PROVIDER_SWITCH: Record<string, keyof PlatformSettings["features"]> = {
  google: "googleOAuth",
  "microsoft-entra-id": "microsoftOAuth",
}

/**
 * GET /api/auth/providers lists only the providers that are configured AND switched on, so
 * the login and signup pages (SocialLoginButtons) hide a button the server would refuse.
 */
export async function GET(request: NextRequest) {
  const response = await handlers.GET(request)
  if (!request.nextUrl.pathname.endsWith("/providers") || !response.ok) return response

  try {
    const providers = (await response.clone().json()) as Record<string, unknown> | null
    if (!providers || typeof providers !== "object") return response
    const { features } = await getActivePlatformSettings()
    const visible = Object.fromEntries(
      Object.entries(providers).filter(([id]) => {
        const flag = PROVIDER_SWITCH[id]
        return !flag || features[flag]
      })
    )
    return NextResponse.json(visible, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("Filtering sign-in providers by platform settings failed:", error)
    return response
  }
}

export const { POST } = handlers
