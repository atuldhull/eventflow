"use client"

import { useSyncExternalStore } from "react"
import { viewerTimeZone, zoneNote } from "@/lib/event-time"

const subscribe = () => () => {}

/**
 * The viewer's IANA time zone, or "" during server rendering and hydration (the server
 * can't know it), so pages render the same markup on both sides and fill in after.
 */
export function useViewerTimeZone(): string {
  return useSyncExternalStore(subscribe, () => viewerTimeZone() ?? "", () => "")
}

/**
 * "IST (Asia/Kolkata)" when the event's zone shows a different clock than the viewer's,
 * else null: the label to put next to event times shown in the event's zone.
 */
export function useEventZoneNote(eventTimeZone: string | null | undefined, at?: string | Date): string | null {
  const viewer = useViewerTimeZone()
  if (!viewer) return null
  return zoneNote(eventTimeZone, at, viewer)
}
