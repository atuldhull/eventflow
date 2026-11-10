import { NextResponse } from "next/server"
import { withSuperAdmin } from "@/lib/guards"
import { getClientInfo } from "@/lib/audit"
import { enterpriseStatusSchema } from "@/lib/enterprise-admin"
import { setEnterpriseActive } from "@/lib/enterprise-lifecycle"

/**
 * Activate or deactivate an enterprise. Body `{ isActive?, confirm? }`: without isActive it
 * toggles. Deactivating locks every member out and takes its events off the public site,
 * so it needs the enterprise's name typed as `confirm` (checked here, not just in the UI).
 */
export const PATCH = withSuperAdmin(async (req, { user, params }) => {
  const parsed = enterpriseStatusSchema.safeParse((await req.json().catch(() => ({}))) ?? {})
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message ?? "Validation failed" }, { status: 400 })
  }

  const { ipAddress, userAgent } = getClientInfo(req)
  const result = await setEnterpriseActive({
    enterpriseId: params.id,
    actorId: user.id,
    isActive: parsed.data.isActive,
    confirm: parsed.data.confirm,
    ipAddress,
    userAgent,
  })
  if (!result.ok) {
    return NextResponse.json({ success: false, message: result.message }, { status: result.status })
  }

  return NextResponse.json({
    success: true,
    message: `${result.enterprise.name} ${result.enterprise.isActive ? "activated" : "deactivated"}`,
    data: result.enterprise,
  })
})
