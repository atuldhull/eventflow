import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import type { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"

type NotificationPreferences = Record<string, { email: boolean; inApp: boolean }>

// User has no preferences column; the settings page's choices live under
// User.metadata.notificationPreferences, next to any other metadata keys.
const PREF_KEY = /^[a-z0-9_]{1,40}$/
const MAX_PREF_KEYS = 50

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** `{ [category]: { email: boolean, inApp: boolean } }`, or null when the shape is wrong. */
function parseNotificationPreferences(value: unknown): NotificationPreferences | null {
  if (!isPlainObject(value)) return null
  const entries = Object.entries(value)
  if (entries.length > MAX_PREF_KEYS) return null
  const prefs: NotificationPreferences = {}
  for (const [key, pref] of entries) {
    if (!PREF_KEY.test(key) || !isPlainObject(pref)) return null
    if (typeof pref.email !== "boolean" || typeof pref.inApp !== "boolean") return null
    prefs[key] = { email: pref.email, inApp: pref.inApp }
  }
  return prefs
}

function readNotificationPreferences(metadata: Prisma.JsonValue | null): NotificationPreferences {
  return (isPlainObject(metadata) && parseNotificationPreferences(metadata.notificationPreferences)) || {}
}

const profileSelect = {
  id: true, name: true, email: true, phone: true, city: true, bio: true,
  collegeName: true, companyName: true, designation: true, avatar: true, metadata: true,
} satisfies Prisma.UserSelect

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: profileSelect,
  })
  if (!user) return NextResponse.json({ success: true, data: null })

  const { metadata, ...profile } = user
  return NextResponse.json({
    success: true,
    data: { ...profile, notificationPreferences: readNotificationPreferences(metadata) },
  })
}

export async function PATCH(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const allowedFields = ["name", "phone", "city", "bio", "collegeName", "companyName", "designation"]
  const data: Record<string, string> = {}
  for (const key of allowedFields) {
    if (key in body) data[key] = body[key] || null
  }
  // Name must not be empty
  if ("name" in data && !data.name) {
    return NextResponse.json({ success: false, message: "Name is required" }, { status: 400 })
  }

  let metadata: Prisma.InputJsonObject | undefined
  if ("notificationPreferences" in body) {
    const prefs = parseNotificationPreferences(body.notificationPreferences)
    if (!prefs) {
      return NextResponse.json({ success: false, message: "Invalid notification preferences" }, { status: 400 })
    }
    const current = await prisma.user.findUnique({ where: { id: session.user.id }, select: { metadata: true } })
    const currentMetadata = current?.metadata
    const otherMetadata = isPlainObject(currentMetadata) ? (currentMetadata as Prisma.JsonObject) : {}
    metadata = { ...otherMetadata, notificationPreferences: prefs }
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: { ...data, ...(metadata ? { metadata } : {}) },
    select: profileSelect,
  })

  const { metadata: savedMetadata, ...profile } = user
  return NextResponse.json({
    success: true,
    data: { ...profile, notificationPreferences: readNotificationPreferences(savedMetadata) },
  })
}
