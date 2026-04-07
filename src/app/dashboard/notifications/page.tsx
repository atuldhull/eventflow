"use client"

import { useState, useEffect } from "react"
import { Bell, ClipboardCheck, CreditCard, Clock, Megaphone, Award, Trash2, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

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

const categoryIcons: Record<string, typeof Bell> = {
  REGISTRATION: ClipboardCheck,
  PAYMENT: CreditCard,
  REMINDER: Clock,
  ANNOUNCEMENT: Megaphone,
  CERTIFICATE: Award,
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [tab, setTab] = useState("all")

  useEffect(() => {
    const fetchNotifications = async () => {
      setIsLoading(true)
      try {
        const params = new URLSearchParams({ limit: "50" })
        if (tab === "unread") params.set("isRead", "false")
        if (!["all", "unread"].includes(tab)) params.set("category", tab.toUpperCase())

        const res = await fetch(`/api/notifications?${params}`)
        const data = await res.json()
        if (data.success) setNotifications(data.data)
      } catch {
        toast.error("Failed to load notifications")
      } finally {
        setIsLoading(false)
      }
    }
    fetchNotifications()
  }, [tab])

  const markAllRead = async () => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      })
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
      toast.success("All marked as read")
    } catch {}
  }

  const deleteNotification = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}`, { method: "DELETE" })
      setNotifications((prev) => prev.filter((n) => n.id !== id))
    } catch {}
  }

  const formatTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <PageHeader
        title="Notifications"
        actions={
          <Button variant="outline" size="sm" onClick={markAllRead}>
            Mark All as Read
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">Unread</TabsTrigger>
          <TabsTrigger value="registration">Registration</TabsTrigger>
          <TabsTrigger value="announcement">Events</TabsTrigger>
          <TabsTrigger value="payment">Payments</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-16">
              <Bell className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="font-medium">No notifications</p>
              <p className="text-sm text-muted-foreground mt-1">You&apos;re all caught up!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((n) => {
                const Icon = categoryIcons[n.category] || Bell
                return (
                  <div
                    key={n.id}
                    className={cn(
                      "flex items-start gap-3 rounded-lg border p-4 transition-colors",
                      !n.isRead && "bg-primary/5 border-primary/20"
                    )}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn("text-sm", !n.isRead && "font-medium")}>{n.title}</p>
                        <span className="text-[10px] text-muted-foreground shrink-0">{formatTime(n.createdAt)}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">{n.message}</p>
                      {n.event && (
                        <Badge variant="secondary" className="text-[10px] mt-1">{n.event.title}</Badge>
                      )}
                    </div>
                    <button
                      onClick={() => deleteNotification(n.id)}
                      className="text-muted-foreground/50 hover:text-destructive shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
