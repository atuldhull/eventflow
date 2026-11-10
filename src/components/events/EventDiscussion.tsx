"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
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
    <section aria-labelledby="discussion-heading" className="border-t border-rule pt-8">
      <h2 id="discussion-heading" className="text-base font-semibold tracking-[-0.01em]">
        Discussion
        {!isLoading && <span className="ml-2 font-normal text-muted-foreground tabular-nums">{messages.length}</span>}
      </h2>

      {/* Post a message */}
      {session?.user ? (
        <form
          className="mt-4"
          onSubmit={(e) => {
            e.preventDefault()
            handleSend()
          }}
        >
          <label htmlFor="discussion-message" className="sr-only">Your message</label>
          <Textarea
            id="discussion-message"
            placeholder="Ask a question or share something with other attendees…"
            rows={3}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            maxLength={500}
            className="min-h-20 resize-y text-sm"
          />
          <div className="mt-2 flex justify-end">
            <Button type="submit" size="sm" disabled={isSending || !newMessage.trim()} className="gap-1.5">
              {isSending && <Loader2 className="animate-spin" />}
              Post
            </Button>
          </div>
        </form>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          <Link href={`/login?callbackUrl=/events/${slug}`} className="font-medium text-foreground underline underline-offset-4 hover:text-brand">
            Sign in
          </Link>{" "}
          to join the discussion.
        </p>
      )}

      {/* Messages */}
      {isLoading ? (
        <div className="mt-5 space-y-4" aria-busy="true" aria-label="Loading discussion">
          {[0, 1].map((i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="size-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3.5 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      ) : messages.length > 0 ? (
        <ul className="mt-5 max-h-[32rem] divide-y divide-rule overflow-y-auto">
          {messages.map((msg) => (
            <li key={msg.id} className="flex gap-3 py-3.5 first:pt-0">
              <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-raised text-xs font-medium text-muted-foreground">
                {msg.author?.[0]?.toUpperCase() || "?"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-medium">{msg.author}</span>
                  <span className="text-xs text-muted-foreground">{timeAgo(msg.createdAt)}</span>
                </p>
                <p className="mt-0.5 text-sm leading-relaxed whitespace-pre-wrap break-words text-muted-foreground">{msg.message}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-5 rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          No discussion yet. Be the first to post!
        </p>
      )}
    </section>
  )
}
