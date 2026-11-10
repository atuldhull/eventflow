import { NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { withSuperAdmin } from "@/lib/guards"
import { createAuditLog, getClientInfo } from "@/lib/audit"
import { firstIssue } from "@/lib/enterprise-admin"
import { changedSections, platformSettingsSchema, unavailableSettingIssue } from "@/lib/platform-settings"
import { getPlatformSettings, savePlatformSettings } from "@/lib/platform-settings-store"

/** How mail actually leaves the server (from env); shown read-only next to the sender fields. */
function emailTransport() {
  if (process.env.RESEND_API_KEY) return { provider: "Resend", host: "api.resend.com", envFrom: process.env.EMAIL_FROM || null }
  return {
    provider: "SMTP",
    host: process.env.SMTP_HOST ? `${process.env.SMTP_HOST}:${process.env.SMTP_PORT || "1025"}` : null,
    envFrom: process.env.EMAIL_FROM || null,
  }
}

export const GET = withSuperAdmin(async () => {
  const { settings, updatedAt } = await getPlatformSettings()
  return NextResponse.json({
    success: true,
    data: { settings, updatedAt: updatedAt?.toISOString() ?? null, emailTransport: emailTransport() },
  })
})

export const POST = withSuperAdmin(async (req, { user }) => {
  const parsed = platformSettingsSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: firstIssue(parsed.error) }, { status: 400 })
  }

  // switches the platform can't honour yet (SMS, 2FA, enterprise self-registration) are refused, not saved
  const unavailable = unavailableSettingIssue(parsed.data)
  if (unavailable) {
    return NextResponse.json({ success: false, message: unavailable }, { status: 400 })
  }

  const { settings: before } = await getPlatformSettings()
  const changed = changedSections(before, parsed.data)
  await savePlatformSettings(parsed.data, user.id)

  const { ipAddress, userAgent } = getClientInfo(req)
  await createAuditLog({
    userId: user.id,
    action: "UPDATE",
    entityType: "PLATFORM",
    entityId: "settings",
    description: changed.length ? `Updated platform settings: ${changed.join(", ")}` : "Saved platform settings (no changes)",
    oldValues: Object.fromEntries(changed.map((k) => [k, before[k]])) as Prisma.InputJsonValue,
    newValues: Object.fromEntries(changed.map((k) => [k, parsed.data[k]])) as Prisma.InputJsonValue,
    ipAddress,
    userAgent,
  })

  const { settings, updatedAt } = await getPlatformSettings()
  return NextResponse.json({
    success: true,
    message: "Settings saved",
    data: { settings, updatedAt: updatedAt?.toISOString() ?? null, emailTransport: emailTransport() },
  })
})
