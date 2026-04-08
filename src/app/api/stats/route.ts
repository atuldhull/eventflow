import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"

// Public endpoint — returns real platform stats for landing page
// Cached for 5 minutes to avoid DB pressure on every page load

let cachedStats: any = null
let cacheTime = 0

export async function GET() {
  const now = Date.now()
  if (cachedStats && now - cacheTime < 5 * 60 * 1000) {
    return NextResponse.json({ success: true, data: cachedStats })
  }

  const [events, registrations, organizations, users] = await Promise.all([
    prisma.event.count({ where: { deletedAt: null, status: { not: "DRAFT" } } }),
    prisma.registration.count(),
    prisma.organization.count({ where: { isActive: true, deletedAt: null } }),
    prisma.user.count({ where: { deletedAt: null } }),
  ])

  cachedStats = { events, registrations, organizations, users }
  cacheTime = now

  return NextResponse.json({ success: true, data: cachedStats })
}
