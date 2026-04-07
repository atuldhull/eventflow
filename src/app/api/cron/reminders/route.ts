import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import prisma from "@/lib/prisma"
import { sendEmail } from "@/lib/email"

// This endpoint should be called every hour by an external scheduler (Vercel Cron, crontab, etc.)
// It finds events starting within the next 24h or 1h and sends reminders to registered participants

export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized calls
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET || process.env.NEXTAUTH_SECRET
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()
  const in1h = new Date(now.getTime() + 60 * 60 * 1000)
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const in25h = new Date(now.getTime() + 25 * 60 * 60 * 1000)

  let sent = 0

  // 24-hour reminders: events starting between 24h and 25h from now
  const events24h = await prisma.event.findMany({
    where: { deletedAt: null, status: { in: ["PUBLISHED", "REGISTRATION_OPEN", "ONGOING"] }, startDate: { gte: in24h, lt: in25h } },
    select: { id: true, title: true, startDate: true, venue: true, venueCity: true, isOnline: true, slug: true, registrations: { where: { status: { in: ["CONFIRMED", "PENDING"] } }, select: { userId: true, user: { select: { name: true, email: true } } } } },
  })

  for (const event of events24h) {
    for (const reg of event.registrations) {
      try {
        await prisma.notification.create({
          data: { userId: reg.userId, type: "REMINDER" as any, category: "EVENT" as any, title: "Event Tomorrow!", message: `"${event.title}" starts tomorrow at ${event.startDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}. ${event.isOnline ? "Check your email for the meeting link." : `Venue: ${event.venue || event.venueCity || "TBA"}`}` },
        })
        sent++
      } catch {}
    }
  }

  // 1-hour reminders: events starting between 1h and 2h from now
  const in2h = new Date(now.getTime() + 2 * 60 * 60 * 1000)
  const events1h = await prisma.event.findMany({
    where: { deletedAt: null, status: { in: ["PUBLISHED", "REGISTRATION_OPEN", "ONGOING"] }, startDate: { gte: in1h, lt: in2h } },
    select: { id: true, title: true, startDate: true, slug: true, registrations: { where: { status: { in: ["CONFIRMED", "PENDING"] } }, select: { userId: true, user: { select: { name: true, email: true } } } } },
  })

  for (const event of events1h) {
    for (const reg of event.registrations) {
      try {
        await prisma.notification.create({
          data: { userId: reg.userId, type: "REMINDER" as any, category: "EVENT" as any, title: "Starting Soon!", message: `"${event.title}" starts in 1 hour! Get ready.` },
        })
        sent++
      } catch {}
    }
  }

  return NextResponse.json({ success: true, message: `Sent ${sent} reminders`, events24h: events24h.length, events1h: events1h.length })
}
