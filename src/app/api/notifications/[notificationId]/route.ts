import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { markAsRead, deleteNotification } from "@/lib/notifications"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ notificationId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { notificationId } = await params
  // scoped to the signed-in user: someone else's notification is "not found"
  const { count } = await markAsRead(notificationId, session.user.id)
  if (count === 0) {
    return NextResponse.json({ success: false, message: "Notification not found" }, { status: 404 })
  }
  return NextResponse.json({ success: true, message: "Notification marked as read" })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ notificationId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { notificationId } = await params
  const { count } = await deleteNotification(notificationId, session.user.id)
  if (count === 0) {
    return NextResponse.json({ success: false, message: "Notification not found" }, { status: 404 })
  }
  return NextResponse.json({ success: true, message: "Notification deleted" })
}
