import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"
import { generateApiKey, listApiKeys } from "@/lib/api-keys"
import { z } from "zod/v4"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })

  const { orgId } = await params
  const keys = await listApiKeys(orgId)
  return NextResponse.json({ success: true, data: keys })
}

const createKeySchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.string()).min(1),
  expiresAt: z.string().optional(),
  rateLimit: z.number().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })

  const { orgId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_MANAGE_SETTINGS, { organizationId: orgId })
  if (!authResult.authorized) return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })

  try {
    const body = await request.json()
    const parsed = createKeySchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ success: false, message: "Validation failed" }, { status: 400 })

    const result = await generateApiKey({
      name: parsed.data.name,
      organizationId: orgId,
      createdById: session.user.id,
      scopes: parsed.data.scopes,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : undefined,
      rateLimit: parsed.data.rateLimit,
    })

    return NextResponse.json({ success: true, data: result }, { status: 201 })
  } catch (error) {
    console.error("Create API key error:", error)
    return NextResponse.json({ success: false, message: "Failed to create API key" }, { status: 500 })
  }
}
