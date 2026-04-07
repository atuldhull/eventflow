import prisma from "@/lib/prisma"
import type { NotificationType, NotificationCategory } from "@prisma/client"

interface CreateNotificationParams {
  userId: string
  type: NotificationType
  category: NotificationCategory
  title: string
  message: string
  data?: Record<string, string>
  eventId?: string
  senderId?: string
  scheduledFor?: Date
}

export async function createNotification(params: CreateNotificationParams) {
  return prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      category: params.category,
      title: params.title,
      message: params.message,
      data: params.data ? (params.data as any) : undefined,
      eventId: params.eventId,
      senderId: params.senderId,
      scheduledFor: params.scheduledFor,
      sentAt: params.scheduledFor ? undefined : new Date(),
    },
  })
}

export async function createBulkNotifications(
  userIds: string[],
  params: Omit<CreateNotificationParams, "userId">
) {
  const data = userIds.map((userId) => ({
    userId,
    type: params.type,
    category: params.category,
    title: params.title,
    message: params.message,
    data: params.data ? (params.data as any) : undefined,
    eventId: params.eventId,
    senderId: params.senderId,
    sentAt: new Date(),
  }))

  const result = await prisma.notification.createMany({ data })
  return { created: result.count }
}

export async function markAsRead(notificationId: string, userId: string) {
  return prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: true, readAt: new Date() },
  })
}

export async function markAllAsRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  })
}

export async function deleteNotification(notificationId: string, userId: string) {
  return prisma.notification.deleteMany({
    where: { id: notificationId, userId },
  })
}

export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: { userId, isRead: false },
  })
}

export async function getUserNotifications(
  userId: string,
  params?: { category?: string; isRead?: boolean; page?: number; limit?: number }
) {
  const page = params?.page || 1
  const limit = params?.limit || 20

  const where: Record<string, unknown> = { userId }
  if (params?.category) where.category = params.category
  if (params?.isRead !== undefined) where.isRead = params.isRead

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where: where as any,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        type: true,
        category: true,
        title: true,
        message: true,
        data: true,
        isRead: true,
        readAt: true,
        createdAt: true,
        eventId: true,
        event: { select: { title: true, slug: true } },
      },
    }),
    prisma.notification.count({ where: where as any }),
  ])

  return { notifications, total, page, totalPages: Math.ceil(total / limit) }
}

// Notification trigger helpers
export const notify = {
  async registrationConfirmed(registration: { userId: string; eventId: string; registrationNumber: string }, eventTitle: string) {
    await createNotification({
      userId: registration.userId,
      type: "IN_APP",
      category: "REGISTRATION",
      title: "Registration Confirmed",
      message: `Your registration for ${eventTitle} has been confirmed. Registration #: ${registration.registrationNumber}`,
      data: { actionUrl: "/dashboard/tickets" },
      eventId: registration.eventId,
    })
  },

  async paymentConfirmed(userId: string, eventId: string, amount: number, eventTitle: string) {
    await createNotification({
      userId,
      type: "IN_APP",
      category: "PAYMENT",
      title: "Payment Confirmed",
      message: `Payment of ₹${amount.toLocaleString("en-IN")} for ${eventTitle} has been confirmed.`,
      data: { actionUrl: "/dashboard/tickets" },
      eventId,
    })
  },

  async eventReminder(userId: string, eventId: string, eventTitle: string, hours: number) {
    await createNotification({
      userId,
      type: "IN_APP",
      category: "REMINDER",
      title: hours >= 24 ? "Event Tomorrow" : "Event Starting Soon",
      message: hours >= 24
        ? `Reminder: ${eventTitle} is happening tomorrow!`
        : `${eventTitle} starts in ${hours} hour${hours > 1 ? "s" : ""}!`,
      data: { actionUrl: "/dashboard/tickets" },
      eventId,
    })
  },

  async eventCancelled(userId: string, eventId: string, eventTitle: string, reason: string) {
    await createNotification({
      userId,
      type: "IN_APP",
      category: "UPDATE",
      title: "Event Cancelled",
      message: `${eventTitle} has been cancelled. Reason: ${reason}`,
      eventId,
    })
  },

  async certificateReady(userId: string, eventId: string, eventTitle: string) {
    await createNotification({
      userId,
      type: "IN_APP",
      category: "CERTIFICATE",
      title: "Certificate Available",
      message: `Your certificate for ${eventTitle} is ready for download.`,
      data: { actionUrl: "/dashboard/certificates" },
      eventId,
    })
  },

  async announcement(userId: string, eventId: string, eventTitle: string, announcementTitle: string) {
    await createNotification({
      userId,
      type: "IN_APP",
      category: "ANNOUNCEMENT",
      title: announcementTitle,
      message: `New update for ${eventTitle}`,
      data: { actionUrl: `/events/${eventId}` },
      eventId,
    })
  },
}
