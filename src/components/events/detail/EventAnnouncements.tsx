"use client"

import { useEffect, useState } from "react"
import { Pin } from "lucide-react"
import { Pill } from "@/components/ui/pill"
import { formatInZone } from "@/lib/event-time"
import { EventSection } from "./EventSection"

interface Announcement {
  id: string
  title: string
  content: string
  priority: string
  isPinned: boolean
  publishedAt: string | null
}

/**
 * The organizer's published updates for this event (GET /api/events/[slug]/announcements):
 * pinned first, then newest. Renders nothing while loading or when there are none.
 */
export function EventAnnouncements({ slug, timeZone }: { slug: string; timeZone?: string | null }) {
  const [items, setItems] = useState<Announcement[]>([])

  useEffect(() => {
    let cancelled = false
    fetch(`/api/events/${encodeURIComponent(slug)}/announcements`)
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled && json?.success && Array.isArray(json.data)) setItems(json.data)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [slug])

  if (items.length === 0) return null

  return (
    <EventSection id="announcements" title="Announcements" meta={items.length}>
      <ul className="divide-y divide-rule rounded-lg border">
        {items.map((a) => (
          <li key={a.id} className="px-4 py-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {a.isPinned && <Pin className="size-3.5 shrink-0 text-muted-foreground" aria-label="Pinned" />}
              <h3 className="text-sm font-medium">{a.title}</h3>
              {(a.priority === "URGENT" || a.priority === "HIGH") && (
                <Pill tone={a.priority === "URGENT" ? "negative" : "warning"}>{a.priority === "URGENT" ? "Urgent" : "Important"}</Pill>
              )}
            </div>
            {a.publishedAt && (
              <p className="mt-0.5 text-[13px] text-muted-foreground tabular-nums">
                {formatInZone(a.publishedAt, timeZone, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
              </p>
            )}
            <p className="mt-2 max-w-[68ch] text-sm leading-6 whitespace-pre-wrap text-foreground/90">{a.content}</p>
          </li>
        ))}
      </ul>
    </EventSection>
  )
}
