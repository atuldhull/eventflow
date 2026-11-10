"use client"

import { useEffect, useState } from "react"
import { Banknote } from "lucide-react"
import { PageHeader } from "@/components/shared/PageHeader"
import { KpiStrip } from "@/components/shared/StatCard"
import { EmptyState } from "@/components/shared/EmptyState"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useRBAC } from "@/hooks/useRBAC"
import { formatINR } from "@/lib/utils"

const MONTHS = 6

interface Report {
  totalRevenue: number
  totalRefunds: number
  netRevenue: number
  totalTransactions: number
  dailyRevenue: { date: string; revenue: number }[]
}

/** YYYY-MM-DD of the first day of the month `monthsBack` months before this one (UTC). */
function monthStart(monthsBack: number) {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsBack, 1)).toISOString().slice(0, 10)
}

/**
 * What the organization has collected and what is due to it. EventFlow keeps no payout
 * ledger of its own: Razorpay settles collected payments to the organizer's bank account,
 * so this page reports collections (by payment date) rather than inventing settlements.
 */
export default function PayoutsPage() {
  const { currentOrganizationId } = useRBAC()
  const [report, setReport] = useState<Report | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!currentOrganizationId) return
    let cancelled = false
    async function load() {
      try {
        const params = new URLSearchParams({ dateFrom: monthStart(MONTHS - 1), dateTo: new Date().toISOString().slice(0, 10) })
        const res = await fetch(`/api/admin/org/${currentOrganizationId}/payments/report?${params}`)
        const json = await res.json()
        if (cancelled) return
        if (json.success) setReport(json.data)
        else setError(json.message || "Could not load collections")
      } catch {
        if (!cancelled) setError("Could not load collections")
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [currentOrganizationId])

  // collections per calendar month, newest first, including months with nothing collected
  const byMonth = new Map<string, number>()
  for (const d of report?.dailyRevenue ?? []) {
    const key = d.date.slice(0, 7)
    byMonth.set(key, (byMonth.get(key) ?? 0) + d.revenue)
  }
  const months = Array.from({ length: MONTHS }, (_, i) => monthStart(i).slice(0, 7))
  const monthLabel = (key: string) =>
    new Date(`${key}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payouts"
        description="What your events have collected, settled to your bank by Razorpay"
        breadcrumbs={[{ label: "Payments", href: "/admin/org/payments" }, { label: "Payouts" }]}
      />

      {error ? (
        <EmptyState icon={Banknote} title="Collections aren't available" description={error} />
      ) : (
        <>
          <KpiStrip
            isLoading={isLoading}
            items={[
              { label: `Collected, last ${MONTHS} months`, value: formatINR(report?.totalRevenue ?? 0), caption: `${(report?.totalTransactions ?? 0).toLocaleString("en-IN")} payments` },
              { label: "Refunded", value: formatINR(report?.totalRefunds ?? 0) },
              { label: "Net collected", value: formatINR(report?.netRevenue ?? 0), caption: "Before gateway charges" },
            ]}
          />

          <section aria-labelledby="monthly-heading" className="space-y-3">
            <h2 id="monthly-heading" className="text-[15px] font-semibold">Collected by month</h2>
            {isLoading ? (
              <Skeleton className="h-64 rounded-lg" />
            ) : (
              <Card className="gap-0 p-0">
                <ul className="divide-y divide-rule text-sm">
                  {months.map((key) => (
                    <li key={key} className="flex items-center justify-between gap-4 px-5 py-3">
                      <span className="text-muted-foreground">{monthLabel(key)}</span>
                      <span className="font-medium tabular-nums">{formatINR(byMonth.get(key) ?? 0)}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </section>
        </>
      )}

      <section aria-labelledby="fees-heading" className="space-y-3">
        <h2 id="fees-heading" className="text-[15px] font-semibold">Fees and settlement</h2>
        <Card className="gap-0 p-0">
          <dl className="divide-y divide-rule text-sm">
            <div className="flex items-center justify-between gap-4 px-5 py-3">
              <dt className="text-muted-foreground">EventFlow platform fee</dt>
              <dd className="tabular-nums">None</dd>
            </div>
            <div className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <dt className="text-muted-foreground">Settlement</dt>
              <dd className="text-[13px] sm:text-right">Razorpay deducts its gateway charges and settles the rest to your bank account</dd>
            </div>
          </dl>
        </Card>
      </section>
    </div>
  )
}
