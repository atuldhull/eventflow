"use client"

import { useState, useEffect, useCallback } from "react"
import { Mail, CheckCircle, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { PageHeader } from "@/components/shared/PageHeader"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface Message { id: string; name: string; email: string; subject: string; message: string; status: string; createdAt: string }
const statusColors: Record<string, string> = { NEW: "bg-blue-100 text-blue-700", READ: "bg-zinc-100 text-zinc-700", REPLIED: "bg-green-100 text-green-700", CLOSED: "bg-zinc-50 text-zinc-500" }

export default function MessagesPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState("")

  const fetchMessages = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ limit: "50" })
      if (filter) params.set("status", filter)
      const res = await fetch(`/api/super-admin/contact-messages?${params}`)
      const json = await res.json()
      if (json.success) { setMessages(json.data); setUnreadCount(json.unreadCount) }
    } catch {} finally { setIsLoading(false) }
  }, [filter])

  useEffect(() => { fetchMessages() }, [fetchMessages])

  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch("/api/super-admin/contact-messages", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) })
      const json = await res.json()
      if (json.success) { toast.success(`Marked as ${status}`); fetchMessages() }
    } catch { toast.error("Failed") }
  }

  return (
    <div className="space-y-6">
      <PageHeader title={`Contact Messages${unreadCount > 0 ? ` (${unreadCount} new)` : ""}`} description="Messages from the contact form" breadcrumbs={[{ label: "Super Admin", href: "/super-admin" }, { label: "Messages" }]} />

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="">All</TabsTrigger>
          <TabsTrigger value="NEW">New {unreadCount > 0 && `(${unreadCount})`}</TabsTrigger>
          <TabsTrigger value="READ">Read</TabsTrigger>
          <TabsTrigger value="REPLIED">Replied</TabsTrigger>
          <TabsTrigger value="CLOSED">Closed</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : messages.length > 0 ? (
        <div className="space-y-3">
          {messages.map((msg) => (
            <Card key={msg.id} className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{msg.name}</p>
                    <Badge variant="secondary" className={statusColors[msg.status] || ""}>{msg.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{msg.email} · {new Date(msg.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                </div>
                <div className="flex gap-1">
                  {msg.status === "NEW" && <Button variant="ghost" size="sm" onClick={() => updateStatus(msg.id, "READ")}>Mark Read</Button>}
                  {msg.status !== "CLOSED" && <Button variant="ghost" size="sm" onClick={() => updateStatus(msg.id, "CLOSED")}>Close</Button>}
                  <Button variant="ghost" size="sm" onClick={() => window.open(`mailto:${msg.email}?subject=Re: ${msg.subject}`)}>Reply</Button>
                </div>
              </div>
              <p className="text-xs font-medium text-muted-foreground">Subject: {msg.subject}</p>
              <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center text-muted-foreground">
          <Mail className="mx-auto h-10 w-10 mb-2 opacity-30" />
          <p className="font-medium">No messages</p>
        </Card>
      )}
    </div>
  )
}
