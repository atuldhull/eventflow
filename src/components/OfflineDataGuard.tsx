"use client"

import { useEffect } from "react"
import { useSession } from "next-auth/react"
import { forgetOfflineData, hasOfflineTickets } from "@/lib/offline-tickets"

/**
 * Removes the offline ticket copy once the server confirms nobody is signed in on this
 * device (sign-out from any screen, expired session). Offline, the session can't be
 * checked, so nothing is removed: the attendee still has their tickets at the door.
 * Costs nothing unless a copy exists.
 */
export function OfflineDataGuard() {
  const { status } = useSession()

  useEffect(() => {
    if (status !== "unauthenticated" || !hasOfflineTickets()) return
    let cancelled = false
    fetch("/api/auth/session", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : undefined))
      .then((session) => {
        // undefined: the check itself failed, so don't decide anything
        if (!cancelled && session !== undefined && !session?.user) return forgetOfflineData()
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [status])

  return null
}
