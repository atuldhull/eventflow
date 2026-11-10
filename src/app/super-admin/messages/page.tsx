"use client"

import { useState, useEffect, useCallback } from "react"
import { Mail, Reply } from "lucide-react"
import { toast } from "sonner"
import { PageHeader } from "@/components/shared/PageHeader"
import { EmptyState } from "@/components/shared/EmptyState"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Pill, type Tone } from "@/components/ui/pill"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { statusLabel } from "@/lib/status-tone"
import { fmtDateTime } from "@/app/admin/enterprise/_components/admin-ui"

interface Message { id: string; name: string; email: string; subject: string; message: string; status: string; createdAt: string }

/** New mail is the one state worth colour here. */
const messageTone: Record<string, Tone> = { NEW: "info", READ: "neutral", REPLIED: "positive", CLOSED: "neutral" }

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
      <PageHeader
        title="Messages"
        description={unreadCount > 0 ? `${unreadCount} new message${unreadCount === 1 ? "" : "s"} from the contact form` : "Messages from the contact form"}
      />

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList variant="line">
          <TabsTrigger value="">All</TabsTrigger>
          <TabsTrigger value="NEW">New{unreadCount > 0 && <span className="text-muted-foreground tabular-nums">{unreadCount}</span>}</TabsTrigger>
          <TabsTrigger value="READ">Read</TabsTrigger>
          <TabsTrigger value="REPLIED">Replied</TabsTrigger>
          <TabsTrigger value="CLOSED">Closed</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <Card className="gap-0 p-0" aria-busy="true" aria-label="Loading messages">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2.5 border-b border-rule px-5 py-4 last:border-0">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-64" />
              <Skeleton className="h-3.5 w-full max-w-lg" />
            </div>
          ))}
        </Card>
      ) : messages.length > 0 ? (
        <Card className="gap-0 p-0">
          <ul className="divide-y divide-rule">
            {messages.map((msg) => (
              <li key={msg.id} className="px-5 py-4">
                <article aria-labelledby={`msg-${msg.id}-subject`} className="flex flex-col gap-3 md:flex-row md:items-start md:gap-6">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="text-sm font-medium">{msg.name}</p>
                      <Pill tone={messageTone[msg.status] ?? "neutral"}>{statusLabel(msg.status)}</Pill>
                    </div>
                    <p className="mt-0.5 text-[13px] text-muted-foreground tabular-nums">
                      <span className="break-all">{msg.email}</span> · {fmtDateTime(msg.createdAt)}
                    </p>
                    <h2 id={`msg-${msg.id}-subject`} className="mt-3 text-sm font-semibold">{msg.subject}</h2>
                    <p className="mt-1 max-w-[72ch] text-sm whitespace-pre-wrap text-foreground/85">{msg.message}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1.5 max-md:[&>*]:flex-1">
                    {msg.status === "NEW" && <Button variant="ghost" size="sm" onClick={() => updateStatus(msg.id, "READ")}>Mark read</Button>}
                    {msg.status !== "CLOSED" && <Button variant="ghost" size="sm" onClick={() => updateStatus(msg.id, "CLOSED")}>Close</Button>}
                    <Button variant="outline" size="sm" onClick={() => window.open(`mailto:${msg.email}?subject=Re: ${msg.subject}`)}>
                      <Reply /> Reply
                    </Button>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <EmptyState icon={Mail} title="No messages" description="Messages sent through the contact form will appear here." />
      )}
    </div>
  )
}
