"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import Link from "next/link"
import { type ColumnDef } from "@tanstack/react-table"
import { AlertTriangle, CreditCard, Download, Loader2, Undo2 } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/PageHeader"
import { KpiStrip } from "@/components/shared/StatCard"
import { EmptyState } from "@/components/shared/EmptyState"
import { DataTable } from "@/components/tables/DataTable"
import { DataTableSearch, DataTableToolbar } from "@/components/tables/DataTableToolbar"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Pill } from "@/components/ui/pill"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/permissions"
import { statusLabel, statusTone } from "@/lib/status-tone"
import { useRBAC } from "@/hooks/useRBAC"
import { useDebounce } from "@/hooks/useDebounce"
import { cn } from "@/lib/utils"

interface PaymentRow {
  id: string
  paymentNumber: string
  participantName: string
  participantEmail: string
  eventTitle: string
  amount: number
  status: string
  method: string
  createdAt: string
  eventId: string | null
  eventCancelled: boolean
  refundAmount: number
}

interface AwaitingRefund { eventId: string; eventTitle: string; payments: number }

const REFUNDABLE = new Set(["COMPLETED", "PARTIALLY_REFUNDED"])
const ONLINE_METHODS = new Set(["RAZORPAY"])

const PAGE_SIZE = 20
const STATUS_FILTERS = ["ALL", "COMPLETED", "PENDING", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED", "CANCELLED"] as const
const filterLabel = (s: string) => (s === "ALL" ? "All statuses" : statusLabel(s))

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`

const baseColumns: ColumnDef<PaymentRow, unknown>[] = [
  { accessorKey: "paymentNumber", header: "Payment", cell: ({ getValue }) => <span className="font-mono text-[13px]">{getValue() as string}</span> },
  {
    accessorKey: "participantName",
    header: "Participant",
    cell: ({ row }) => (
      <div className="min-w-0">
        <p className="truncate font-medium">{row.original.participantName}</p>
        {row.original.participantEmail && <p className="truncate text-[13px] text-muted-foreground">{row.original.participantEmail}</p>}
      </div>
    ),
  },
  {
    accessorKey: "eventTitle",
    header: "Event",
    cell: ({ row }) => (
      <span className="block max-w-[260px] truncate">
        {row.original.eventTitle}
        {row.original.eventCancelled && <span className="text-[13px] text-muted-foreground"> · cancelled</span>}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ getValue }) => {
      const s = getValue() as string
      // a completed payment is money received: positive
      return <Pill tone={statusTone(s === "COMPLETED" ? "completed_payment" : s)}>{statusLabel(s)}</Pill>
    },
  },
  { accessorKey: "method", header: "Method", cell: ({ getValue }) => <span className="text-[13px] text-muted-foreground">{(getValue() as string) || "—"}</span> },
  {
    accessorKey: "createdAt",
    header: "Date",
    cell: ({ getValue }) => (
      <span className="text-muted-foreground">{new Date(getValue() as string).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
    ),
  },
  {
    accessorKey: "amount",
    header: "Amount",
    meta: { align: "right" },
    cell: ({ row }) => (
      <div>
        <span className="font-medium">{inr(row.original.amount)}</span>
        {row.original.refundAmount > 0 && <p className="text-[13px] text-muted-foreground">{inr(row.original.refundAmount)} refunded</p>}
      </div>
    ),
  },
]

export default function OrgPaymentsPage() {
  const { currentOrganizationId, can } = useRBAC()
  const canRefund = can(PERMISSIONS.PAYMENT_MANAGE)
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search.trim())
  const [status, setStatus] = useState<string>("ALL")
  const [page, setPage] = useState(1)
  const [data, setData] = useState<PaymentRow[]>([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState({ totalRevenue: 0, refunds: 0, pending: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [statsLoaded, setStatsLoaded] = useState(false)
  const [awaiting, setAwaiting] = useState<AwaitingRefund[]>([])
  const [refundTarget, setRefundTarget] = useState<PaymentRow | null>(null)
  const [refundAmount, setRefundAmount] = useState("")
  const [refundReason, setRefundReason] = useState("")
  const [isRefunding, setIsRefunding] = useState(false)
  const [refundingEventId, setRefundingEventId] = useState<string | null>(null)

  // a new search or filter starts again from the first page
  const filterKey = `${debouncedSearch}|${status}`
  const [appliedKey, setAppliedKey] = useState(filterKey)
  if (appliedKey !== filterKey) {
    setAppliedKey(filterKey)
    setPage(1)
  }

  // the list's filters, also sent with "Export" so the file matches what is on screen
  const filterParams = new URLSearchParams()
  if (debouncedSearch) filterParams.set("search", debouncedSearch)
  if (status !== "ALL") filterParams.set("status", status)
  const filterQuery = filterParams.toString()

  const fetchData = useCallback(async () => {
    if (!currentOrganizationId) return
    setIsLoading(true)
    try {
      const params = new URLSearchParams(filterQuery)
      params.set("page", String(page))
      params.set("limit", String(PAGE_SIZE))
      const res = await fetch(`/api/admin/org/${currentOrganizationId}/payments?${params}`)
      const json = await res.json()
      if (json.success) {
        setData(json.data)
        setTotal(json.pagination.total)
        setStats(json.stats)
        setAwaiting(json.awaitingRefund ?? [])
        setStatsLoaded(true)
      } else {
        toast.error(json.message || "Failed to load payments")
      }
    } catch { toast.error("Failed to load payments") }
    finally { setIsLoading(false) }
  }, [currentOrganizationId, page, filterQuery])

  useEffect(() => { fetchData() }, [fetchData])

  const refundLeft = refundTarget ? Math.round((refundTarget.amount - refundTarget.refundAmount) * 100) / 100 : 0
  const refundValue = Number(refundAmount)
  const refundValid = refundAmount.trim() !== "" && Number.isFinite(refundValue) && refundValue > 0 && refundValue <= refundLeft

  const submitRefund = async () => {
    if (!currentOrganizationId || !refundTarget || !refundValid || isRefunding) return
    setIsRefunding(true)
    try {
      const res = await fetch(`/api/admin/org/${currentOrganizationId}/payments/${refundTarget.id}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: refundValue, ...(refundReason.trim() ? { reason: refundReason.trim() } : {}) }),
      })
      const json = await res.json().catch(() => ({}))
      if (json.success) {
        toast.success(json.message || "Refunded")
        setRefundTarget(null)
        fetchData()
      } else {
        toast.error(json.message || "Refund failed")
      }
    } catch {
      toast.error("Refund failed. Check your connection and try again.")
    } finally {
      setIsRefunding(false)
    }
  }

  const refundAll = async (a: AwaitingRefund) => {
    if (!currentOrganizationId || refundingEventId) return
    setRefundingEventId(a.eventId)
    try {
      const res = await fetch(`/api/admin/org/${currentOrganizationId}/events/${a.eventId}/refund-all`, { method: "POST" })
      const json = await res.json().catch(() => ({}))
      if (json.success) toast.success(json.message || "Refunded")
      else toast.error(json.message || "Some refunds failed")
      fetchData()
    } catch {
      toast.error("Refunds failed. Check your connection and try again.")
    } finally {
      setRefundingEventId(null)
    }
  }

  const columns = useMemo<ColumnDef<PaymentRow, unknown>[]>(() => {
    if (!canRefund) return baseColumns
    const openRefund = (p: PaymentRow) => {
      setRefundTarget(p)
      setRefundAmount(String(Math.round((p.amount - p.refundAmount) * 100) / 100))
      setRefundReason("")
    }
    return [
      ...baseColumns,
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        // pinned to the right edge on phones, so Refund is reachable without scrolling sideways
        meta: { align: "right", className: "w-12 sm:w-24", stickyRight: true },
        cell: ({ row }) =>
          REFUNDABLE.has(row.original.status) ? (
            <Button variant="ghost" size="sm" onClick={() => openRefund(row.original)} aria-label={`Refund ${row.original.paymentNumber}`}>
              <Undo2 /> <span className="hidden sm:inline">Refund</span>
            </Button>
          ) : null,
      },
    ]
  }, [canRefund])

  const isFiltered = Boolean(debouncedSearch) || status !== "ALL"
  const exportHref = currentOrganizationId
    ? `/api/admin/org/${currentOrganizationId}/payments/export${filterQuery ? `?${filterQuery}` : ""}`
    : undefined

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description="Money in and out across your events"
        actions={
          <>
            <PermissionGate permission={PERMISSIONS.PAYMENT_VIEW_REPORTS}>
              <Link href="/admin/org/payments/reports" className={buttonVariants({ variant: "ghost" })}>Reports</Link>
            </PermissionGate>
            <Link href="/admin/org/payments/payouts" className={buttonVariants({ variant: "ghost" })}>Payouts</Link>
            <PermissionGate permission={PERMISSIONS.PAYMENT_EXPORT}>
              {/* a plain download link: the server sends the file as an attachment */}
              <a
                href={exportHref}
                download
                aria-disabled={!exportHref || total === 0}
                className={cn(buttonVariants({ variant: "outline" }), (!exportHref || total === 0) && "pointer-events-none opacity-50")}
              >
                <Download /> Export{isFiltered ? " filtered" : ""}
              </a>
            </PermissionGate>
          </>
        }
      />

      <KpiStrip
        isLoading={!statsLoaded}
        items={[
          { label: "Total revenue", value: inr(stats.totalRevenue) },
          { label: "Net revenue", value: inr(stats.totalRevenue - stats.refunds) },
          { label: "Refunds", value: inr(stats.refunds) },
          { label: "Pending", value: stats.pending.toLocaleString("en-IN") },
        ]}
      />

      {canRefund && awaiting.length > 0 && (
        <div role="status" className="space-y-3 rounded-lg border bg-pill-warning p-4 text-pill-warning-foreground">
          <p className="flex items-center gap-2 text-sm font-medium">
            <AlertTriangle className="size-4 shrink-0" aria-hidden /> Cancelled events with payments still to refund
          </p>
          <ul className="space-y-2">
            {awaiting.map((a) => (
              <li key={a.eventId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="min-w-0">
                  <span className="font-medium">{a.eventTitle}</span> · {a.payments} payment{a.payments === 1 ? "" : "s"}
                </span>
                <Button size="sm" variant="outline" onClick={() => refundAll(a)} disabled={!!refundingEventId}>
                  {refundingEventId === a.eventId && <Loader2 className="animate-spin" />}
                  Refund all
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-3">
        <DataTableToolbar>
          <DataTableSearch
            placeholder="Search payment #, name or event"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select value={status} onValueChange={(v) => setStatus(v || "ALL")}>
            <SelectTrigger aria-label="Filter by status" className="w-full sm:w-48">
              <SelectValue>{(v: string) => filterLabel(v)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((s) => <SelectItem key={s} value={s}>{filterLabel(s)}</SelectItem>)}
            </SelectContent>
          </Select>
        </DataTableToolbar>
        <DataTable
          columns={columns}
          data={data}
          isLoading={isLoading}
          pagination={{ page, pageSize: PAGE_SIZE, total }}
          onPaginationChange={(p) => setPage(p)}
          emptyState={
            isFiltered ? (
              <EmptyState
                icon={CreditCard}
                title="No matching payments"
                description="Try another search or status."
                className="border-0 py-6"
              />
            ) : (
              <EmptyState
                icon={CreditCard}
                title="No payments yet"
                description="Payments will appear when participants pay for events."
                className="border-0 py-6"
              />
            )
          }
        />
      </div>

      <Dialog open={!!refundTarget} onOpenChange={(open) => { if (!open && !isRefunding) setRefundTarget(null) }}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Refund {refundTarget?.paymentNumber}</DialogTitle>
            <DialogDescription>
              {refundTarget && (
                <>
                  {refundTarget.participantName} · {refundTarget.eventTitle}.{" "}
                  {ONLINE_METHODS.has(refundTarget.method)
                    ? "The money goes back to their original payment method through Razorpay."
                    : "This was paid offline, so pay them back yourself; EventFlow records the refund."}{" "}
                  A full refund cancels their ticket and frees the seat. They get an email either way.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <form
            id="refund-form"
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              void submitRefund()
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="refund-amount">Amount (₹)</Label>
              <Input
                id="refund-amount"
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                max={refundLeft}
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                aria-describedby="refund-amount-hint"
              />
              <p id="refund-amount-hint" className="text-[13px] text-muted-foreground">
                Up to {inr(refundLeft)}{refundTarget && refundTarget.refundAmount > 0 ? ` (${inr(refundTarget.refundAmount)} already refunded)` : ""}.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="refund-reason">Reason <span className="font-normal text-muted-foreground">(optional, shown to the buyer)</span></Label>
              <Textarea id="refund-reason" rows={2} maxLength={500} value={refundReason} onChange={(e) => setRefundReason(e.target.value)} />
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundTarget(null)} disabled={isRefunding}>Keep payment</Button>
            <Button type="submit" form="refund-form" variant="destructive" disabled={!refundValid || isRefunding}>
              {isRefunding && <Loader2 className="animate-spin" />}
              Refund{refundValid ? ` ${inr(refundValue)}` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
