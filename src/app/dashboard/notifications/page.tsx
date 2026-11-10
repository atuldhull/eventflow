"use client"

import { useState, useEffect } from "react"
import { Bell, ClipboardCheck, CreditCard, Clock, Megaphone, Award, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/PageHeader"
import { EmptyState } from "@/components/shared/EmptyState"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
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
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Notifications"
        actions={
          <Button variant="outline" size="sm" onClick={markAllRead}>
            Mark all as read
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList variant="line">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">Unread</TabsTrigger>
          <TabsTrigger value="registration">Registration</TabsTrigger>
          <TabsTrigger value="announcement">Events</TabsTrigger>
          <TabsTrigger value="payment">Payments</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {isLoading ? (
            <div className="space-y-2" aria-busy="true" aria-label="Loading notifications">
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[72px] rounded-lg" />)}
            </div>
          ) : notifications.length === 0 ? (
            <EmptyState icon={Bell} title="No notifications" description="You're all caught up!" />
          ) : (
            <ul className="divide-y divide-rule border-y border-rule">
              {notifications.map((n) => {
                const Icon = categoryIcons[n.category] || Bell
                return (
                  <li key={n.id} className="flex items-start gap-3 py-3.5 pr-1">
                    <span className="relative mt-0.5 shrink-0" aria-hidden>
                      <Icon className="size-[18px] text-muted-foreground" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className={cn("text-sm", !n.isRead && "font-semibold")}>
                          {!n.isRead && (
                            <span className="mr-2 inline-block size-2 rounded-full bg-brand align-middle" aria-label="Unread" role="img" />
                          )}
                          {n.title}
                        </p>
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{formatTime(n.createdAt)}</span>
                      </div>
                      <p className="mt-0.5 text-sm text-muted-foreground">{n.message}</p>
                      {n.event && <p className="mt-1 text-[13px] text-faint">{n.event.title}</p>}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => deleteNotification(n.id)}
                      aria-label={`Delete notification: ${n.title}`}
                      className="-mt-1 shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 />
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
