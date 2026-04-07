import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { getUserNotifications, markAsRead, markAllAsRead } from "@/lib/notifications"

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const category = searchParams.get("category") || undefined
  const isRead = searchParams.get("isRead") === "true" ? true : searchParams.get("isRead") === "false" ? false : undefined
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "20")

  const result = await getUserNotifications(session.user.id, { category, isRead, page, limit })

  return NextResponse.json({
    success: true,
    data: result.notifications.map((n) => ({
      ...n,
      createdAt: n.createdAt.toISOString(),
      readAt: n.readAt?.toISOString() || null,
    })),
    pagination: { page: result.page, total: result.total, totalPages: result.totalPages },
  })
}

export async function PATCH(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()

  if (body.markAll) {
    await markAllAsRead(session.user.id)
    return NextResponse.json({ success: true, message: "All notifications marked as read" })
  }

  if (body.notificationIds && Array.isArray(body.notificationIds)) {
    for (const id of body.notificationIds) {
      await markAsRead(id, session.user.id)
    }
    return NextResponse.json({ success: true, message: "Notifications marked as read" })
  }

  return NextResponse.json({ success: false, message: "Invalid request" }, { status: 400 })
}
