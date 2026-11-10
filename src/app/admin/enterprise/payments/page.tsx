"use client"

import { useState, useEffect, useCallback } from "react"
import { type ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/PageHeader"
import { KpiStrip } from "@/components/shared/StatCard"
import { DataTable } from "@/components/tables/DataTable"
import { Pill } from "@/components/ui/pill"
import { useRBAC } from "@/hooks/useRBAC"
import { useDebounce } from "@/hooks/useDebounce"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/permissions"
import { statusLabel, statusTone } from "@/lib/status-tone"
import { SearchField, TableEmpty, PrimaryCell, fmtDate, inr, num } from "../_components/admin-ui"
import { ExportButton } from "../_components/export-button"

interface PaymentRow { id: string; paymentNumber: string; participantName: string; eventTitle: string; organization: string; amount: number; status: string; method: string; createdAt: string }

/** A completed payment is money received, so it reads positive (events use "completed" as neutral). */
const paymentTone = (s: string) => statusTone(s === "COMPLETED" ? "completed_payment" : s)

const columns: ColumnDef<PaymentRow, unknown>[] = [
  {
    accessorKey: "paymentNumber",
    header: "Payment",
    cell: ({ getValue }) => <span className="font-mono text-xs">{getValue() as string}</span>,
  },
  {
    accessorKey: "participantName",
    header: "Participant",
    cell: ({ getValue }) => <span className="font-medium">{getValue() as string}</span>,
  },
  {
    accessorKey: "eventTitle",
    header: "Event",
    cell: ({ row }) => <PrimaryCell title={<span className="font-normal">{row.original.eventTitle}</span>} meta={row.original.organization} />,
    meta: { className: "min-w-[200px] max-w-[320px]" },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ getValue }) => { const s = getValue() as string; return <Pill tone={paymentTone(s)}>{statusLabel(s)}</Pill> },
  },
  {
    accessorKey: "method",
    header: "Method",
    cell: ({ getValue }) => <span className="text-muted-foreground">{(getValue() as string) || "—"}</span>,
  },
  {
    accessorKey: "createdAt",
    header: "Date",
    cell: ({ getValue }) => <span className="text-muted-foreground">{fmtDate(getValue() as string)}</span>,
  },
  {
    accessorKey: "amount",
    header: "Amount",
    cell: ({ getValue }) => <span className="font-medium">{inr(getValue() as number)}</span>,
    meta: { align: "right" },
  },
]

export default function EnterprisePaymentsPage() {
  const { currentEnterpriseId } = useRBAC()
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search)
  const [page, setPage] = useState(1)
  const [data, setData] = useState<PaymentRow[]>([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState({ totalRevenue: 0, refunds: 0, pending: 0 })
  const [isLoading, setIsLoading] = useState(true)

  const fetchData = useCallback(async () => {
    if (!currentEnterpriseId) return
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" })
      if (debouncedSearch) params.set("search", debouncedSearch)
      const res = await fetch(`/api/admin/enterprise/${currentEnterpriseId}/payments?${params}`)
      const json = await res.json()
      if (json.success) { setData(json.data); setTotal(json.pagination.total); setStats(json.stats) }
    } catch { toast.error("Failed to load") } finally { setIsLoading(false) }
  }, [currentEnterpriseId, page, debouncedSearch])

  const exportUrl = currentEnterpriseId
    ? `/api/admin/enterprise/${currentEnterpriseId}/payments/export${debouncedSearch ? `?search=${encodeURIComponent(debouncedSearch)}` : ""}`
    : ""

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description="Money in and out across your enterprise"
        actions={
          exportUrl ? (
            <PermissionGate permission={PERMISSIONS.PAYMENT_EXPORT}>
              <ExportButton url={exportUrl} fallbackName="payments.csv" />
            </PermissionGate>
          ) : null
        }
      />
      <KpiStrip
        items={[
          { label: "Total revenue", value: inr(stats.totalRevenue) },
          { label: "Net revenue", value: inr(stats.totalRevenue - stats.refunds), caption: "After refunds" },
          { label: "Refunds", value: inr(stats.refunds) },
          { label: "Pending", value: num(stats.pending), caption: "Payments" },
        ]}
      />
      <SearchField value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Search by payment #, participant or event…" className="sm:max-w-sm" />
      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        pagination={{ page, pageSize: 20, total }}
        onPaginationChange={(p) => setPage(p)}
        emptyState={
          debouncedSearch
            ? <TableEmpty title="No matching payments" description="Try a different search." />
            : <TableEmpty title="No payments yet" description="Payments for paid events across your organizations will show here." />
        }
      />
    </div>
  )
}
