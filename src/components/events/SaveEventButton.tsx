"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Heart, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface Props {
  eventId: string
  /** "icon" for compact (event cards), "button" for the event-detail sidebar */
  variant?: "icon" | "button"
  /** Optional className override on the outer element */
  className?: string
}

export function SaveEventButton({ eventId, variant = "icon", className }: Props) {
  const router = useRouter()
  const { status } = useSession()
  const [saved, setSaved] = useState<boolean | null>(null)
  const [pending, setPending] = useState(false)

  // Probe whether the event is already saved (only when authenticated)
  useEffect(() => {
    if (status !== "authenticated") {
      setSaved(false)
      return
    }
    let cancelled = false
    fetch(`/api/users/me/saved-events/${eventId}`, { cache: "no-store" })
      .then(async (res) => {
        if (cancelled) return
        if (res.ok) {
          const json = await res.json()
          setSaved(!!json?.data?.saved)
        } else {
          setSaved(false)
        }
      })
      .catch(() => { if (!cancelled) setSaved(false) })
    return () => { cancelled = true }
  }, [eventId, status])

  const toggle = useCallback(async (e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (status === "loading") return
    if (status !== "authenticated") {
      toast.info("Log in to save events")
      router.push(`/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`)
      return
    }

    const next = !saved
    setSaved(next)  // Optimistic
    setPending(true)
    try {
      if (next) {
        const res = await fetch("/api/users/me/saved-events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId }),
        })
        if (!res.ok) throw new Error("save failed")
        toast.success("Saved to your list")
      } else {
        const res = await fetch(`/api/users/me/saved-events/${eventId}`, { method: "DELETE" })
        if (!res.ok) throw new Error("unsave failed")
        toast.success("Removed from your list")
      }
    } catch {
      setSaved(!next)  // Revert
      toast.error("Couldn't update your saved events")
    } finally {
      setPending(false)
    }
  }, [eventId, saved, status, router])

  const label = saved ? "Remove from saved" : "Save for later"

  if (variant === "button") {
    return (
      <Button
        variant="outline"
        className={cn("w-full gap-2", className)}
        onClick={toggle}
        disabled={pending || saved === null}
        aria-pressed={!!saved}
        aria-label={label}
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Heart className={cn("size-4", saved && "fill-current")} />
        )}
        {saved ? "Saved" : "Save"}
      </Button>
    )
  }

  // Sits on a cover or poster: a solid round chip (no blur); lemon with a filled heart when saved.
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending || saved === null}
      aria-pressed={!!saved}
      aria-label={label}
      title={label}
      className={cn(
        "press inline-flex size-10 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-sm transition-colors hover:border-lavender disabled:opacity-60 pointer-coarse:size-11",
        saved && "border-transparent bg-lemon text-lemon-ink hover:border-transparent",
        className
      )}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Heart className={cn("size-4", saved && "fill-current")} />
      )}
    </button>
  )
}
