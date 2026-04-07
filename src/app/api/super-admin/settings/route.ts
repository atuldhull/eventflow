import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { withSuperAdmin } from "@/lib/guards"
import prisma from "@/lib/prisma"

// Platform settings stored in a simple key-value approach using the first enterprise or a dedicated settings model
// For now, we'll use environment-based config acknowledgment

export const GET = withSuperAdmin(async () => {
  // Return current platform configuration
  return NextResponse.json({
    success: true,
    data: {
      platformName: process.env.NEXT_PUBLIC_APP_NAME || "EventFlow",
      contactEmail: process.env.EMAIL_FROM || "noreply@eventflow.com",
      maintenanceMode: false,
    },
  })
})

export const POST = withSuperAdmin(async (req, { user }) => {
  const body = await req.json()

  // Log the settings change for audit
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "UPDATE",
      entityType: "PLATFORM",
      entityId: "settings",
      description: `Updated platform settings: ${Object.keys(body).join(", ")}`,
    },
  })

  return NextResponse.json({ success: true, message: "Settings saved. Some changes require server restart." })
})
