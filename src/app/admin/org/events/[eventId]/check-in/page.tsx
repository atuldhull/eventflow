"use client"

import { use, useState, useCallback, useEffect } from "react"
import { QrCode, Search, ArrowLeft, Download } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

import { EmptyState } from "@/components/shared/EmptyState"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { QRScanner } from "@/components/check-in/QRScanner"
import { CheckInResult } from "@/components/check-in/CheckInResult"
import { CheckInSearch } from "@/components/check-in/CheckInSearch"
import { UndoCheckInDialog } from "@/components/check-in/UndoCheckInDialog"
import { useRBAC } from "@/hooks/useRBAC"
import { PERMISSIONS } from "@/lib/permissions"
import { cn } from "@/lib/utils"
import { CapacityBar, ZoneNote, fmtTime } from "../../_components/event-admin"

type ScanResult = {
  type: "success" | "already" | "invalid" | "error"
  participantName?: string
  ticketType?: string
  message?: string
  checkedInAt?: string
} | null

/** The most recent scan, kept on screen until the next one (Undo needs the check-in id). */
type LastScan = NonNullable<ScanResult> & { seq: number; checkInId?: string }

interface CheckInStats {
  expected: number
  checkedIn: number
  notArrived: number
  recent: { id: string; name: string | null; time: string; method: string; by: string | null; ticketType: string | null }[]
  byTicketType: { type: string; total: number; checkedIn: number }[]
}

const EMPTY_STATS: CheckInStats = { expected: 0, checkedIn: 0, notArrived: 0, recent: [], byTicketType: [] }

export default function EventCheckInPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params)
  const { currentOrganizationId } = useRBAC()
  const [scanMode, setScanMode] = useState<"qr" | "manual">("qr")
  const [scanResult, setScanResult] = useState<ScanResult>(null)
  const [lastScan, setLastScan] = useState<LastScan | null>(null)
  const [isUndoing, setIsUndoing] = useState(false)
  const [scannerEnabled, setScannerEnabled] = useState(true)
  const [checkInStats, setCheckInStats] = useState<CheckInStats>(EMPTY_STATS)
  const [statsLoaded, setStatsLoaded] = useState(false)
  const [eventTitle, setEventTitle] = useState("")
  // Times on this screen read on the event's clock (Event.timezone), not the device's
  const [eventTimeZone, setEventTimeZone] = useState<string | null>(null)
  // The scan whose Undo was tapped in the banner, waiting for the confirm.
  const [bannerUndo, setBannerUndo] = useState<{ checkInId: string; name?: string } | null>(null)
  // Permissions on this event (event team roles included), e.g. a door volunteer's.
  const [eventPermissions, setEventPermissions] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    async function fetchPermissions() {
      try {
        const res = await fetch(`/api/auth/permissions?eventId=${encodeURIComponent(eventId)}`)
        const json = await res.json()
        if (!cancelled && json.success && Array.isArray(json.permissions)) setEventPermissions(json.permissions)
      } catch {}
    }
    fetchPermissions()
    return () => { cancelled = true }
  }, [eventId])

  // Same rule as /api/check-in/export; hidden until the permissions are known.
  const canExport = eventPermissions.includes(PERMISSIONS.REGISTRATION_EXPORT) || eventPermissions.includes(PERMISSIONS.CHECKIN_MANAGE)

  // Event name for the header (read-only; falls back to the id when it can't be read)
  useEffect(() => {
    if (!currentOrganizationId) return
    let cancelled = false
    async function fetchTitle() {
      try {
        const res = await fetch(`/api/admin/org/${currentOrganizationId}/events/${eventId}`)
        const json = await res.json()
        if (!cancelled && json.success) {
          setEventTitle(json.data.title)
          setEventTimeZone(typeof json.data.timezone === "string" ? json.data.timezone : null)
        }
      } catch {}
    }
    fetchTitle()
    return () => { cancelled = true }
  }, [currentOrganizationId, eventId])

  // Live check-in numbers. The stats API names the expected count `totalExpected`.
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`/api/check-in/stats?eventId=${encodeURIComponent(eventId)}`)
      const json = await res.json()
      if (json.success) {
        const d = json.data
        setCheckInStats({
          expected: d.totalExpected || 0,
          checkedIn: d.checkedIn || 0,
          notArrived: d.notArrived || 0,
          recent: Array.isArray(d.recentCheckIns) ? d.recentCheckIns : [],
          byTicketType: Array.isArray(d.byTicketType) ? d.byTicketType : [],
        })
      }
    } catch {} finally {
      setStatsLoaded(true)
    }
  }, [eventId])

  useEffect(() => {
    void fetchStats()
    const interval = setInterval(fetchStats, 10000) // Refresh every 10s
    return () => clearInterval(interval)
  }, [fetchStats])

  const show = useCallback((result: NonNullable<ScanResult>, checkInId?: string) => {
    setScanResult(result)
    setLastScan((prev) => ({ ...result, checkInId, seq: (prev?.seq ?? 0) + 1 }))
    if (result.type === "success") void fetchStats()
  }, [fetchStats])

  const handleQRScan = useCallback(async (qrData: string) => {
    setScannerEnabled(false)

    try {
      const res = await fetch("/api/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "QR_SCAN", qrData, eventId }),
      })

      const data = await res.json()

      if (data.success) {
        show({
          type: "success",
          participantName: data.data?.participant?.name,
          ticketType: data.data?.ticket?.type,
        }, data.data?.checkIn?.id)
      } else if (data.reason === "ALREADY_CHECKED_IN" || data.reason === "ALREADY_USED") {
        show({
          type: "already",
          participantName: data.participant?.name,
          message: data.message,
          checkedInAt: data.checkedInAt,
        })
      } else {
        show({
          type: "invalid",
          message: data.message,
        })
      }
    } catch {
      show({ type: "error", message: "Network error. Check-in queued." })
    }
  }, [eventId, show])

  const handleDismissResult = useCallback(() => {
    setScanResult(null)
    setScannerEnabled(true)
  }, [])

  // Dismissing a repeat/invalid/error result also clears it from the screen
  const handleDismissAndClear = useCallback(() => {
    handleDismissResult()
    setLastScan(null)
  }, [handleDismissResult])

  /** Resolves to the new check-in's id, or null when it failed (the list then stays as it was). */
  const handleManualCheckIn = async (registrationId: string): Promise<string | null> => {
    try {
      const res = await fetch("/api/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "MANUAL", registrationId, eventId }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`${data.data?.participant?.name} checked in`)
        void fetchStats()
        return data.data?.checkIn?.id ?? null
      }
      toast.error(data.message || "Check-in failed")
    } catch {
      toast.error("Check-in failed")
    }
    return null
  }

  const handleUndoCheckIn = async (checkInId: string) => {
    try {
      const res = await fetch("/api/check-in/undo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkInId }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success("Check-in reversed")
        void fetchStats()
        return true
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error("Failed to undo check-in")
    }
    return false
  }

  // Undo from the last-scan banner, once confirmed: the same request as Undo in the attendee
  // list. The target is the scan the banner showed when Undo was tapped.
  const undoLastScan = async () => {
    const target = bannerUndo
    if (!target) return
    setIsUndoing(true)
    const ok = await handleUndoCheckIn(target.checkInId)
    setIsUndoing(false)
    setBannerUndo(null)
    if (ok && lastScan?.checkInId === target.checkInId) {
      setLastScan(null)
      if (scanResult) handleDismissResult()
    }
  }

  const pct = checkInStats.expected > 0 ? Math.round((checkInStats.checkedIn / checkInStats.expected) * 100) : 0

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {/* Header: back, event, export */}
      <div className="flex items-center gap-2">
        <Link
          href="/admin/org/check-in"
          aria-label="Back to check-in"
          className="-ml-2 flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground pointer-coarse:size-11"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[17px] leading-6 font-semibold sm:text-[22px] sm:leading-7">{eventTitle || "Event check-in"}</h1>
          <p className="truncate text-[13px] text-muted-foreground">
            Check-in{!eventTitle && <> · ID <span className="font-mono">{eventId.slice(0, 8)}…</span></>}
            <ZoneNote timeZone={eventTimeZone} className="before:content-['_·_']" />
          </p>
        </div>
        {canExport && (
          <Button variant="ghost" size="sm" className="shrink-0" onClick={() => window.open(`/api/check-in/export?eventId=${encodeURIComponent(eventId)}`)}>
            <Download /> CSV
          </Button>
        )}
      </div>

      {/* Live numbers, refreshed every 10 s */}
      <dl className="grid grid-cols-3 divide-x divide-border overflow-hidden rounded-lg border" aria-label="Check-in stats">
        {[
          { label: "Expected", value: checkInStats.expected },
          { label: "Checked in", value: checkInStats.checkedIn, caption: `${pct}%` },
          { label: "Not arrived", value: checkInStats.notArrived },
        ].map((s) => (
          <div key={s.label} className="min-w-0 px-3 py-3 sm:px-4">
            <dt className="truncate text-[13px] text-muted-foreground">{s.label}</dt>
            <dd className="mt-0.5 flex items-baseline gap-1.5 text-[22px] leading-7 tracking-[-0.01em] tabular-nums">
              {s.value.toLocaleString("en-IN")}
              {s.caption && <span className="text-xs tracking-normal text-muted-foreground">{s.caption}</span>}
            </dd>
          </div>
        ))}
      </dl>

      <Tabs defaultValue="scanner" className="gap-0">
        <div className="border-b border-rule">
          <TabsList variant="line">
            <TabsTrigger value="scanner">Scan</TabsTrigger>
            <TabsTrigger value="attendees">Attendees</TabsTrigger>
            <TabsTrigger value="stats">Activity</TabsTrigger>
          </TabsList>
        </div>

        {/* Scanner Tab */}
        <TabsContent value="scanner" className="space-y-4 pt-4">
          {/* Mode toggle */}
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="group" aria-label="Check-in method">
            {([
              { mode: "qr", label: "QR scanner", icon: QrCode },
              { mode: "manual", label: "Manual", icon: Search },
            ] as const).map((m) => (
              <button
                key={m.mode}
                type="button"
                aria-pressed={scanMode === m.mode}
                onClick={() => setScanMode(m.mode)}
                className={cn(
                  "press flex h-9 items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors pointer-coarse:h-11",
                  scanMode === m.mode ? "bg-background text-foreground ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <m.icon className="size-4" aria-hidden /> {m.label}
              </button>
            ))}
          </div>

          {scanMode === "qr" ? (
            <QRScanner
              onScan={handleQRScan}
              enabled={scannerEnabled && !bannerUndo}
            />
          ) : (
            <CheckInSearch
              eventId={eventId}
              onCheckIn={handleManualCheckIn}
              onUndo={handleUndoCheckIn}
            />
          )}

          {/* Last scan */}
          {lastScan && (
            <CheckInResult
              key={lastScan.seq}
              type={lastScan.type}
              participantName={lastScan.participantName}
              ticketType={lastScan.ticketType}
              message={lastScan.message}
              checkedInAt={lastScan.checkedInAt}
              timeZone={eventTimeZone}
              active={!!scanResult}
              onDismiss={lastScan.type === "success" ? handleDismissResult : handleDismissAndClear}
              onUndo={
                lastScan.type === "success" && lastScan.checkInId
                  ? () => setBannerUndo({ checkInId: lastScan.checkInId!, name: lastScan.participantName })
                  : undefined
              }
              isUndoing={isUndoing}
            />
          )}
          <UndoCheckInDialog
            open={!!bannerUndo}
            name={bannerUndo?.name}
            pending={isUndoing}
            onCancel={() => setBannerUndo(null)}
            onConfirm={undoLastScan}
          />
        </TabsContent>

        {/* Attendees Tab */}
        <TabsContent value="attendees" className="pt-4">
          <CheckInSearch
            eventId={eventId}
            onCheckIn={handleManualCheckIn}
            onUndo={handleUndoCheckIn}
          />
        </TabsContent>

        {/* Activity Tab: the latest arrivals and progress per ticket type, refreshed with the stats */}
        <TabsContent value="stats" className="space-y-6 pt-4">
          {!statsLoaded ? (
            <div className="space-y-px border-y border-rule" aria-busy="true" aria-label="Loading activity">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 py-3">
                  <Skeleton className="size-8 rounded-full" />
                  <div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-3 w-1/4" /></div>
                </div>
              ))}
            </div>
          ) : checkInStats.recent.length === 0 ? (
            <EmptyState
              title="No check-ins yet"
              description="Arrivals appear here as participants are checked in."
            />
          ) : (
            <>
              {checkInStats.byTicketType.length > 1 && (
                <section aria-labelledby="by-ticket-heading">
                  <h2 id="by-ticket-heading" className="mb-2 text-[15px] font-semibold">By ticket type</h2>
                  <dl className="divide-y divide-rule rounded-lg border px-4">
                    {checkInStats.byTicketType.map((t) => (
                      <div key={t.type} className="py-3">
                        <div className="flex items-baseline justify-between gap-4 text-sm">
                          <dt className="min-w-0 truncate">{t.type}</dt>
                          <dd className="shrink-0 tabular-nums">
                            {t.checkedIn.toLocaleString("en-IN")} <span className="text-muted-foreground">/ {t.total.toLocaleString("en-IN")}</span>
                          </dd>
                        </div>
                        <CapacityBar value={t.checkedIn} max={t.total} className="mt-2" />
                      </div>
                    ))}
                  </dl>
                </section>
              )}
              <section aria-labelledby="recent-heading">
                <h2 id="recent-heading" className="mb-2 text-[15px] font-semibold">Latest arrivals</h2>
                <ul className="divide-y divide-rule border-y border-rule">
                  {checkInStats.recent.map((c) => (
                    <li key={c.id} className="flex items-center gap-3 py-3">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium" aria-hidden>
                        {c.name?.[0]?.toUpperCase() || "?"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{c.name || "Participant"}</p>
                        <p className="truncate text-[13px] text-muted-foreground">
                          {[c.ticketType, c.method === "QR_SCAN" ? "QR scan" : "Manual", c.by ? `by ${c.by}` : null].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <time dateTime={c.time} className="shrink-0 text-[13px] text-muted-foreground tabular-nums">
                        {fmtTime(c.time, eventTimeZone)}
                      </time>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
