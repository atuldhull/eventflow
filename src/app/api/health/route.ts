import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function GET() {
  const checks: Record<string, { status: string; responseTime?: number }> = {}
  let overallStatus: "healthy" | "degraded" | "unhealthy" = "healthy"

  // Database check
  const dbStart = Date.now()
  try {
    await prisma.$queryRaw`SELECT 1`
    checks.database = { status: "up", responseTime: Date.now() - dbStart }
  } catch {
    checks.database = { status: "down", responseTime: Date.now() - dbStart }
    overallStatus = "unhealthy"
  }

  // Storage check
  checks.storage = { status: process.env.STORAGE_PROVIDER === "s3" ? "configured" : "local" }

  // Email check
  checks.email = {
    status: process.env.RESEND_API_KEY || process.env.SMTP_HOST ? "configured" : "not_configured",
  }

  // Payment check
  checks.payment = {
    status: process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET ? "configured" : "not_configured",
  }

  return NextResponse.json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    uptime: Math.floor(process.uptime()),
    checks,
    environment: process.env.NODE_ENV,
  })
}
