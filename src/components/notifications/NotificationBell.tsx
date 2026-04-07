"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Bell, ClipboardCheck, CreditCard, Clock, RefreshCw, Megaphone, Award, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import Link from "next/link"

interface Notification {
  id: string
  category: string
  title: string
  message: string
  isRead: boolean
  createdAt: string
  data?: Record<string, string> | null
  event?: { title: string; slug: string } | null
}

const categoryIcons: Record<string, { icon: typeof Bell; color: string }> = {
  REGISTRATION: { icon: ClipboardCheck, color: "text-green-500 bg-green-100 dark:bg-green-900/30" },
  PAYMENT: { icon: CreditCard, color: "text-blue-500 bg-blue-100 dark:bg-blue-900/30" },
  REMINDER: { icon: Clock, color: "text-amber-500 bg-amber-100 dark:bg-amber-900/30" },
  UPDATE: { icon: RefreshCw, color: "text-purple-500 bg-purple-100 dark:bg-purple-900/30" },
  ANNOUNCEMENT: { icon: Megaphone, color: "text-orange-500 bg-orange-100 dark:bg-orange-900/30" },
  CERTIFICATE: { icon: Award, color: "text-teal-500 bg-teal-100 dark:bg-teal-900/30" },
  SYSTEM: { icon: Settings, color: "text-zinc-500 bg-zinc-100 dark:bg-zinc-800" },
}

export function NotificationBell() {
  const router = useRouter()
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Poll unread count
  useEffect(() => {
    const fetchCount = async () => {
      try {
        const res = await fetch("/api/notifications/unread-count")
        const data = await res.json()
        if (data.success) setUnreadCount(data.data.count)
      } catch {}
    }
    fetchCount()
    const interval = setInterval(fetchCount, 30000)
    return () => clearInterval(interval)
  }, [])

  // Fetch notifications when opened
  useEffect(() => {
    if (!open) return
    const fetchNotifications = async () => {
      setIsLoading(true)
      try {
        const res = await fetch("/api/notifications?limit=10")
        const data = await res.json()
        if (data.success) setNotifications(data.data)
      } catch {}
      finally { setIsLoading(false) }
    }
    fetchNotifications()
  }, [open])

  const markAllRead = async () => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      })
      setUnreadCount(0)
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
    } catch {}
  }

  const handleClick = async (notification: Notification) => {
    // Mark as read
    if (!notification.isRead) {
      await fetch(`/api/notifications/${notification.id}`, { method: "PATCH" })
      setUnreadCount((prev) => Math.max(0, prev - 1))
      setNotifications((prev) =>
        prev.map((n) => n.id === notification.id ? { ...n, isRead: true } : n)
      )
    }

    setOpen(false)

    // Navigate
    const actionUrl = notification.data?.actionUrl
    if (actionUrl) router.push(actionUrl)
  }

  const formatTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return "just now"
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="ghost" size="icon" className="relative" />}>
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b">
          <h3 className="text-sm font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="text-xs text-primary hover:underline">
              Mark all as read
            </button>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Loading...</div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="mx-auto h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
            </div>
          ) : (
            notifications.map((n) => {
              const catConfig = categoryIcons[n.category] || categoryIcons.SYSTEM
              const Icon = catConfig.icon
              return (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={cn(
                    "w-full flex items-start gap-3 p-3 text-left hover:bg-accent transition-colors border-b last:border-0",
                    !n.isRead && "bg-primary/5"
                  )}
                >
                  <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", catConfig.color)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm line-clamp-1", !n.isRead && "font-medium")}>{n.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{formatTime(n.createdAt)}</p>
                  </div>
                  {!n.isRead && <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-2" />}
                </button>
              )
            })
          )}
        </div>

        <div className="p-2 border-t">
          <Link
            href="/dashboard/notifications"
            onClick={() => setOpen(false)}
            className="block text-center text-xs text-primary hover:underline py-1"
          >
            View All Notifications
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}
