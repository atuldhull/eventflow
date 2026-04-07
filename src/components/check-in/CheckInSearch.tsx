"use client"

import { useState, useEffect, useCallback } from "react"
import { Search, CheckCircle, Undo2, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { useDebounce } from "@/hooks/useDebounce"
import { cn } from "@/lib/utils"

interface SearchResult {
  registrationId: string
  registrationNumber: string
  participant: { name: string; email: string; avatar?: string | null }
  ticketType: string
  isCheckedIn: boolean
  checkedInAt: string | null
  checkInId: string | null
}

interface CheckInSearchProps {
  eventId: string
  onCheckIn: (registrationId: string) => Promise<void>
  onUndo: (checkInId: string) => Promise<void>
}

export function CheckInSearch({ eventId, onCheckIn, onUndo }: CheckInSearchProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [loadingId, setLoadingId] = useState<string | null>(null)
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
      await onCheckIn(registrationId)
      // Update local state
      setResults((prev) =>
        prev.map((r) =>
          r.registrationId === registrationId
            ? { ...r, isCheckedIn: true, checkedInAt: new Date().toISOString() }
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
      await onUndo(checkInId)
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
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, or registration #"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10 h-12 text-base"
          autoFocus
        />
        {isSearching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
      </div>

      <div className="space-y-2">
        {results.map((r) => (
          <div
            key={r.registrationId}
            className={cn(
              "flex items-center justify-between rounded-lg border p-3",
              r.isCheckedIn && "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900"
            )}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-medium shrink-0">
                {r.participant.name[0]?.toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-medium truncate">{r.participant.name}</p>
                <p className="text-xs text-muted-foreground truncate">{r.participant.email}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="secondary" className="text-[10px]">{r.ticketType}</Badge>
                  <span className="text-[10px] text-muted-foreground font-mono">{r.registrationNumber}</span>
                </div>
              </div>
            </div>

            <div className="shrink-0 ml-3">
              {r.isCheckedIn ? (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={() => r.checkInId && handleUndo(r.checkInId, r.registrationId)}
                    disabled={loadingId === r.registrationId}
                  >
                    {loadingId === r.registrationId ? <Loader2 className="h-3 w-3 animate-spin" /> : <Undo2 className="h-3 w-3" />}
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  onClick={() => handleCheckIn(r.registrationId)}
                  disabled={loadingId === r.registrationId}
                  className="gap-1"
                >
                  {loadingId === r.registrationId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Check In"}
                </Button>
              )}
            </div>
          </div>
        ))}

        {query.length >= 2 && !isSearching && results.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">No participants found</p>
        )}
      </div>
    </div>
  )
}
