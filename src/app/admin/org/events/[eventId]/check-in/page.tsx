"use client"

import { use, useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { QrCode, Search, BarChart3, Users, ArrowLeft, Download } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

import { PageHeader } from "@/components/shared/PageHeader"
import { StatCard } from "@/components/shared/StatCard"
import { Card } from "@/components/ui/card"
import { Button, buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { QRScanner } from "@/components/check-in/QRScanner"
import { CheckInResult } from "@/components/check-in/CheckInResult"
import { CheckInSearch } from "@/components/check-in/CheckInSearch"
import { cn } from "@/lib/utils"

type ScanResult = {
  type: "success" | "already" | "invalid" | "error"
  participantName?: string
  ticketType?: string
  message?: string
  checkedInAt?: string
} | null

export default function EventCheckInPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params)
  const [scanMode, setScanMode] = useState<"qr" | "manual">("qr")
  const [scanResult, setScanResult] = useState<ScanResult>(null)
  const [scannerEnabled, setScannerEnabled] = useState(true)
  const [checkInStats, setCheckInStats] = useState({ expected: 0, checkedIn: 0, notArrived: 0 })

  // Fetch real check-in stats
  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch(`/api/check-in/stats?eventId=${eventId}`)
        const json = await res.json()
        if (json.success) setCheckInStats({ expected: json.data.expected || 0, checkedIn: json.data.checkedIn || 0, notArrived: json.data.notArrived || 0 })
      } catch {}
    }
    fetchStats()
    const interval = setInterval(fetchStats, 10000) // Refresh every 10s
    return () => clearInterval(interval)
  }, [eventId])

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
        setScanResult({
          type: "success",
          participantName: data.data?.participant?.name,
          ticketType: data.data?.ticket?.type,
        })
      } else if (data.reason === "ALREADY_CHECKED_IN") {
        setScanResult({
          type: "already",
          participantName: data.participant?.name,
          message: data.message,
          checkedInAt: data.checkedInAt,
        })
      } else {
        setScanResult({
          type: "invalid",
          message: data.message,
        })
      }
    } catch {
      setScanResult({ type: "error", message: "Network error. Check-in queued." })
    }
  }, [eventId])

  const handleDismissResult = useCallback(() => {
    setScanResult(null)
    setScannerEnabled(true)
  }, [])

  const handleManualCheckIn = async (registrationId: string) => {
    try {
      const res = await fetch("/api/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "MANUAL", registrationId, eventId }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`${data.data?.participant?.name} checked in!`)
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error("Check-in failed")
    }
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
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error("Failed to undo check-in")
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/org/check-in" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold">Event Check-in</h1>
            <p className="text-xs text-muted-foreground">ID: {eventId.slice(0, 8)}...</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-1" onClick={() => window.open(`/api/check-in/export?eventId=${eventId}`)}>
          <Download className="h-3.5 w-3.5" /> Export
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="scanner">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="scanner" className="gap-1"><QrCode className="h-3.5 w-3.5" /> Scanner</TabsTrigger>
          <TabsTrigger value="attendees" className="gap-1"><Users className="h-3.5 w-3.5" /> Attendees</TabsTrigger>
          <TabsTrigger value="stats" className="gap-1"><BarChart3 className="h-3.5 w-3.5" /> Stats</TabsTrigger>
        </TabsList>

        {/* Scanner Tab */}
        <TabsContent value="scanner" className="mt-4 space-y-4">
          {/* Mode Toggle */}
          <div className="flex gap-2">
            <Button
              variant={scanMode === "qr" ? "default" : "outline"}
              size="sm"
              onClick={() => setScanMode("qr")}
              className="gap-1"
            >
              <QrCode className="h-3.5 w-3.5" /> QR Scanner
            </Button>
            <Button
              variant={scanMode === "manual" ? "default" : "outline"}
              size="sm"
              onClick={() => setScanMode("manual")}
              className="gap-1"
            >
              <Search className="h-3.5 w-3.5" /> Manual
            </Button>
          </div>

          {scanMode === "qr" ? (
            <QRScanner
              onScan={handleQRScan}
              enabled={scannerEnabled}
            />
          ) : (
            <CheckInSearch
              eventId={eventId}
              onCheckIn={handleManualCheckIn}
              onUndo={handleUndoCheckIn}
            />
          )}
        </TabsContent>

        {/* Attendees Tab */}
        <TabsContent value="attendees" className="mt-4">
          <CheckInSearch
            eventId={eventId}
            onCheckIn={handleManualCheckIn}
            onUndo={handleUndoCheckIn}
          />
        </TabsContent>

        {/* Stats Tab */}
        <TabsContent value="stats" className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard title="Expected" value={String(checkInStats.expected)} icon={Users} iconColor="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" />
            <StatCard title="Checked In" value={String(checkInStats.checkedIn)} icon={QrCode} iconColor="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" description={checkInStats.expected > 0 ? `${Math.round((checkInStats.checkedIn / checkInStats.expected) * 100)}%` : "0%"} />
            <StatCard title="Not Arrived" value={String(checkInStats.notArrived)} icon={Users} iconColor="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" />
          </div>

          <Card className="p-6">
            <h3 className="text-sm font-medium mb-4">Check-in Activity</h3>
            <p className="text-sm text-muted-foreground text-center py-8">
              Check-in activity will appear here in real-time as participants arrive.
            </p>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Scan Result Overlay */}
      {scanResult && (
        <CheckInResult
          type={scanResult.type}
          participantName={scanResult.participantName}
          ticketType={scanResult.ticketType}
          message={scanResult.message}
          checkedInAt={scanResult.checkedInAt}
          onDismiss={handleDismissResult}
        />
      )}
    </div>
  )
}
