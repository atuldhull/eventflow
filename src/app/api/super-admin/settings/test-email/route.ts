import { NextResponse } from "next/server"
import { z } from "zod/v4"
import { withSuperAdmin } from "@/lib/guards"
import { sendEmail } from "@/lib/email"
import { createAuditLog, getClientInfo } from "@/lib/audit"
import { rateLimiter } from "@/lib/rate-limiter"
import { getPlatformSettings } from "@/lib/platform-settings-store"

const bodySchema = z.object({ to: z.email("Enter a valid email").optional() })

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

/**
 * Sends a test message through the real sender (src/lib/email.ts) and reports exactly what
 * it returned: a failure is a failure, with the sender's own error text.
 */
export const POST = withSuperAdmin(async (req, { user }) => {
  const parsed = bodySchema.safeParse((await req.json().catch(() => ({}))) ?? {})
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "Enter a valid email" }, { status: 400 })
  }

  const rl = await rateLimiter.check(`super-admin:test-email:${user.id}`, 5, 60 * 1000)
  if (!rl.allowed) {
    return NextResponse.json({ success: false, message: "Too many test emails. Try again in a minute." }, { status: 429 })
  }

  const to = parsed.data.to || user.email
  if (!to) {
    return NextResponse.json({ success: false, message: "Your account has no email address to send to" }, { status: 400 })
  }

  const { settings } = await getPlatformSettings()
  const name = escapeHtml(settings.general.platformName)
  const result = await sendEmail({
    to,
    subject: `${settings.general.platformName} test email`,
    html: `<p>This is a test email from ${name}'s platform settings.</p><p>If you can read this, outgoing email works.</p>`,
    text: `This is a test email from ${settings.general.platformName}'s platform settings. If you can read this, outgoing email works.`,
  })

  const { ipAddress, userAgent } = getClientInfo(req)
  await createAuditLog({
    userId: user.id,
    action: "CREATE",
    entityType: "PLATFORM",
    entityId: "test-email",
    description: result.success ? `Sent a test email to ${to}` : `Test email to ${to} failed: ${result.error ?? "unknown error"}`,
    ipAddress,
    userAgent,
  })

  if (!result.success) {
    const unconfigured = !process.env.RESEND_API_KEY && !process.env.SMTP_HOST
    const message = `${result.error || "The email sender reported a failure"}${
      unconfigured ? " (neither RESEND_API_KEY nor SMTP_HOST is set on the server)" : ""
    }`
    return NextResponse.json(
      { success: false, message, data: { to } },
      { status: 502 }
    )
  }
  return NextResponse.json({ success: true, message: `Test email sent to ${to}`, data: { to, messageId: result.messageId ?? null } })
})
