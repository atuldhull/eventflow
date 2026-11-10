"use client"

import { useState, useEffect } from "react"
import { Search, CheckCircle, Undo2, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Pill } from "@/components/ui/pill"
import { toast } from "sonner"
import { useDebounce } from "@/hooks/useDebounce"
import { UndoCheckInDialog } from "./UndoCheckInDialog"

interface SearchResult {
  registrationId: string
  registrationNumber: string
  /** the "TKT-…" number printed under the QR, when the registration has a ticket */
  ticketNumber: string | null
  participant: { name: string; email: string; avatar?: string | null }
  ticketType: string
  isCheckedIn: boolean
  checkedInAt: string | null
  checkInId: string | null
}

interface CheckInSearchProps {
  eventId: string
  /** Resolves to the new check-in's id, or null when the check-in failed. */
  onCheckIn: (registrationId: string) => Promise<string | null>
  /** Resolves to whether the check-in was reversed. */
  onUndo: (checkInId: string) => Promise<boolean>
}

export function CheckInSearch({ eventId, onCheckIn, onUndo }: CheckInSearchProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  // the row whose Undo was tapped, waiting for the confirm
  const [confirming, setConfirming] = useState<SearchResult | null>(null)
  const debouncedQuery = useDebounce(query, 200)

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResults([])
      return
    }

    const search = async () => {
      setIsSearching(true)
      try {
        const res = await fetch(`/api/check-in/search?eventId=${eventId}&search=${encodeURIComponent(debouncedQuery)}`)
        const data = await res.json()
        if (data.success) setResults(data.data)
      } catch {
        toast.error("Search failed")
      } finally {
        setIsSearching(false)
      }
    }
    search()
  }, [debouncedQuery, eventId])

  const handleCheckIn = async (registrationId: string) => {
    setLoadingId(registrationId)
    try {
      // Only a successful check-in changes the row; its id is kept so Undo works right away.
      const checkInId = await onCheckIn(registrationId)
      if (!checkInId) return
      setResults((prev) =>
        prev.map((r) =>
          r.registrationId === registrationId
            ? { ...r, isCheckedIn: true, checkedInAt: new Date().toISOString(), checkInId }
            : r
        )
      )
    } finally {
      setLoadingId(null)
    }
  }

  const handleUndo = async (checkInId: string, registrationId: string) => {
    setLoadingId(registrationId)
    try {
      if (!(await onUndo(checkInId))) return
      setResults((prev) =>
        prev.map((r) =>
          r.registrationId === registrationId
            ? { ...r, isCheckedIn: false, checkedInAt: null, checkInId: null }
            : r
        )
      )
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-faint" aria-hidden />
        <Input
          type="search"
          aria-label="Search participants"
          placeholder="Name, email, ticket or registration #"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-12 pr-10 pl-10 text-base md:text-base pointer-coarse:h-12"
          autoFocus
        />
        {isSearching && <Loader2 className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-label="Searching" />}
      </div>

      {results.length > 0 && (
        <ul className="divide-y divide-rule rounded-lg border">
          {results.map((r) => (
            <li key={r.registrationId} className="flex items-center gap-3 px-3 py-3 sm:px-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium" aria-hidden>
                {r.participant.name[0]?.toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.participant.name}</p>
                <p className="truncate text-[13px] text-muted-foreground">{r.participant.email}</p>
                <p className="mt-0.5 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                  <span className="truncate">{r.ticketType}</span>
                  {r.ticketNumber && (
                    <>
                      <span aria-hidden>·</span>
                      <span className="shrink-0 font-mono">{r.ticketNumber}</span>
                    </>
                  )}
                  <span aria-hidden className={r.ticketNumber ? "max-sm:hidden" : undefined}>·</span>
                  <span className={r.ticketNumber ? "shrink-0 font-mono max-sm:hidden" : "shrink-0 font-mono"}>{r.registrationNumber}</span>
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                {r.isCheckedIn ? (
                  <>
                    <Pill tone="positive" dot className="max-sm:hidden">Checked in</Pill>
                    <CheckCircle className="size-5 text-positive sm:hidden" aria-label="Checked in" />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground"
                      aria-label={`Undo check-in for ${r.participant.name}`}
                      onClick={() => r.checkInId && setConfirming(r)}
                      disabled={loadingId === r.registrationId}
                    >
                      {loadingId === r.registrationId ? <Loader2 className="animate-spin" /> : <Undo2 />}
                      <span className="max-sm:sr-only">Undo</span>
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => handleCheckIn(r.registrationId)}
                    disabled={loadingId === r.registrationId}
                    className="min-w-[92px]"
                  >
                    {loadingId === r.registrationId ? <Loader2 className="animate-spin" /> : "Check in"}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {query.length >= 2 && !isSearching && results.length === 0 && (
        <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">No participants found</p>
      )}
      {query.length < 2 && (
        <p className="px-1 text-[13px] text-muted-foreground">Type at least two characters to search.</p>
      )}

      <UndoCheckInDialog
        open={!!confirming}
        name={confirming?.participant.name}
        pending={!!confirming && loadingId === confirming.registrationId}
        onCancel={() => setConfirming(null)}
        onConfirm={async () => {
          const target = confirming
          if (target?.checkInId) await handleUndo(target.checkInId, target.registrationId)
          setConfirming(null)
        }}
      />
    </div>
  )
}
