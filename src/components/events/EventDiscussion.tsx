"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { Send, MessageCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { toast } from "sonner"

interface Message {
  id: string
  author: string
  avatar: string | null
  message: string
  createdAt: string
}

interface EventDiscussionProps {
  slug: string
}

export function EventDiscussion({ slug }: EventDiscussionProps) {
  const { data: session } = useSession()
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${slug}/discussions`)
      const json = await res.json()
      if (json.success) setMessages(json.data)
    } catch {} finally { setIsLoading(false) }
  }, [slug])

  useEffect(() => { fetchMessages() }, [fetchMessages])

  const handleSend = async () => {
    if (!newMessage.trim()) return
    setIsSending(true)
    try {
      const res = await fetch(`/api/events/${slug}/discussions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: newMessage }),
      })
      const json = await res.json()
      if (json.success) {
        setNewMessage("")
        fetchMessages()
      } else toast.error(json.message)
    } catch { toast.error("Failed to send") }
    finally { setIsSending(false) }
  }

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return "just now"
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
  }

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-4 w-4" />
        <h3 className="text-sm font-medium">Discussion ({messages.length})</h3>
      </div>

      {/* Post new message */}
      {session?.user ? (
        <div className="flex gap-2">
          <Textarea
            placeholder="Ask a question or share something with other attendees..."
            rows={2}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            maxLength={500}
            className="text-sm"
          />
          <Button onClick={handleSend} disabled={isSending || !newMessage.trim()} size="icon" className="shrink-0 h-auto">
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          <a href={`/login?callbackUrl=/events/${slug}`} className="text-primary hover:underline">Sign in</a> to join the discussion
        </p>
      )}

      {/* Messages */}
      {isLoading ? (
        <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : messages.length > 0 ? (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {messages.map((msg) => (
            <div key={msg.id} className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                {msg.author?.[0]?.toUpperCase() || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{msg.author}</span>
                  <span className="text-xs text-muted-foreground">{timeAgo(msg.createdAt)}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{msg.message}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4">No discussion yet. Be the first to post!</p>
      )}
    </Card>
  )
}
