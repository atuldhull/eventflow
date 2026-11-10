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
    <div className="mx-auto max-w-2xl space-y-4 sm:space-y-5">
      {/* Header: back, event, export */}
      <div className="flex items-center gap-2">
        <Link
          href="/admin/org/check-in"
          aria-label="Back to check-in"
          className="-ml-2 flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-[20px] leading-7 font-bold tracking-[-0.025em] sm:text-[28px] sm:leading-8">{eventTitle || "Event check-in"}</h1>
          <p className="truncate text-[13px] text-muted-foreground">
            Door check-in{!eventTitle && <> · ID <span className="font-mono">{eventId.slice(0, 8)}…</span></>}
            <ZoneNote timeZone={eventTimeZone} className="before:content-['_·_']" />
          </p>
        </div>
        {canExport && (
          <Button variant="outline" size="sm" className="shrink-0" onClick={() => window.open(`/api/check-in/export?eventId=${encodeURIComponent(eventId)}`)}>
            <Download /> CSV
          </Button>
        )}
      </div>

      {/* Live numbers, refreshed every 10 s: the door's one big number */}
      <section className="rounded-2xl border bg-card px-5 pt-4 pb-5 sm:px-6" aria-label="Live check-in">
        <div className="flex items-center justify-between gap-3 text-[13px] text-muted-foreground">
          <span className="font-medium text-foreground">Checked in</span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-positive motion-reduce:animate-none" />
            Live
          </span>
        </div>
        <dl aria-label="Check-in stats">
          <div className="mt-1">
            <dt className="sr-only">Checked in</dt>
            <dd className="flex flex-wrap items-baseline gap-x-2 font-display tabular-nums">
              <span className="text-[64px] leading-[0.95] font-bold tracking-[-0.05em] sm:text-[88px]">
                {checkInStats.checkedIn.toLocaleString("en-IN")}
              </span>
              <span aria-hidden className="text-[28px] leading-none font-semibold tracking-[-0.03em] text-muted-foreground sm:text-[36px]">
                / {checkInStats.expected.toLocaleString("en-IN")}
              </span>
            </dd>
          </div>
          <div
            role="meter"
            aria-valuemin={0}
            aria-valuemax={checkInStats.expected}
            aria-valuenow={checkInStats.checkedIn}
            aria-label={`${checkInStats.checkedIn} of ${checkInStats.expected} checked in`}
            className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-muted"
          >
            <div className="h-full rounded-full bg-brand transition-[width] duration-500" style={{ width: `${Math.min(100, pct)}%` }} />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-[13px]">
            <div className="min-w-0">
              <dt className="truncate text-muted-foreground">Arrived</dt>
              <dd className="mt-0.5 font-display text-lg leading-6 font-semibold tabular-nums">{pct}%</dd>
            </div>
            <div className="min-w-0 text-center">
              <dt className="truncate text-muted-foreground">Not arrived</dt>
              <dd className="mt-0.5 font-display text-lg leading-6 font-semibold tabular-nums">{checkInStats.notArrived.toLocaleString("en-IN")}</dd>
            </div>
            <div className="min-w-0 text-right">
              <dt className="truncate text-muted-foreground">Expected</dt>
              <dd className="mt-0.5 font-display text-lg leading-6 font-semibold tabular-nums">{checkInStats.expected.toLocaleString("en-IN")}</dd>
            </div>
          </div>
        </dl>
      </section>

      <Tabs defaultValue="scanner" className="gap-0">
        <div className="border-b border-rule">
          <TabsList variant="line" className="group-data-horizontal/tabs:h-11">
            <TabsTrigger value="scanner" className="px-3 text-[15px]">Scan</TabsTrigger>
            <TabsTrigger value="attendees" className="px-3 text-[15px]">Attendees</TabsTrigger>
            <TabsTrigger value="stats" className="px-3 text-[15px]">Activity</TabsTrigger>
          </TabsList>
        </div>

        {/* Scanner Tab */}
        <TabsContent value="scanner" className="space-y-4 pt-4">
          {/* Mode toggle: camera or name search, one tap apart */}
          <div className="grid grid-cols-2 gap-1 rounded-full border bg-muted p-1" role="group" aria-label="Check-in method">
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
                  "press flex h-12 items-center justify-center gap-2 rounded-full text-[15px] font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  scanMode === m.mode ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <m.icon className="size-[18px]" aria-hidden /> {m.label}
              </button>
            ))}
          </div>

          {/* Last scan: above the camera so it is seen at a glance */}
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
                  <h2 id="by-ticket-heading" className="mb-2 font-display text-[17px] font-semibold tracking-[-0.01em]">By ticket type</h2>
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
                <h2 id="recent-heading" className="mb-2 font-display text-[17px] font-semibold tracking-[-0.01em]">Latest arrivals</h2>
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
