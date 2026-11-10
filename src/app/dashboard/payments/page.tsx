"use client"

import { useState, useEffect } from "react"
import { CreditCard } from "lucide-react"

import { PageHeader } from "@/components/shared/PageHeader"
import { EmptyState } from "@/components/shared/EmptyState"
import { KpiStrip } from "@/components/shared/StatCard"
import { Pill } from "@/components/ui/pill"
import { Skeleton } from "@/components/ui/skeleton"
import { statusLabel, statusTone } from "@/lib/status-tone"

interface Payment {
  id: string
  amount: number
  currency: string
  status: string
  method: string | null
  createdAt: string
  event: { title: string; slug: string }
}

export default function MyPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [totalSpent, setTotalSpent] = useState(0)

  useEffect(() => {
    async function fetchPayments() {
      try {
        const res = await fetch("/api/users/me/dashboard")
        const json = await res.json()
        if (json.success) {
          setTotalSpent(json.data.stats.totalSpent || 0)
        }
        // Try fetching detailed payments (if the API exists)
        const payRes = await fetch("/api/users/me/payments")
        const payJson = await payRes.json()
        if (payJson.success) {
          setPayments(payJson.data)
        }
      } catch {} finally { setIsLoading(false) }
    }
    fetchPayments()
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader title="Payments" description="Your payment history" />

      <KpiStrip
        isLoading={isLoading}
        items={[
          { label: "Total spent", value: `₹${totalSpent.toLocaleString("en-IN")}` },
          { label: "Transactions", value: payments.length.toLocaleString("en-IN") },
          { label: "Refunds", value: payments.filter((p) => p.status === "REFUNDED").length.toLocaleString("en-IN") },
        ]}
      />

      {isLoading ? (
        <div className="space-y-2" aria-busy="true" aria-label="Loading payments">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
        </div>
      ) : payments.length > 0 ? (
        <div className="overflow-hidden rounded-lg border">
          <div className="hidden grid-cols-[minmax(0,1fr)_140px_120px_120px] gap-4 border-b border-rule bg-raised px-4 py-2.5 text-xs font-medium text-muted-foreground sm:grid">
            <span>Event</span>
            <span>Date</span>
            <span>Status</span>
            <span className="text-right">Amount</span>
          </div>
          <ul className="divide-y divide-rule">
            {payments.map((payment) => (
              <li
                key={payment.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_140px_120px_120px]"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{payment.event?.title || "Event Payment"}</p>
                  {payment.method && <p className="text-[13px] text-muted-foreground">{payment.method}</p>}
                </div>
                <p className="order-3 text-[13px] text-muted-foreground tabular-nums sm:order-none sm:text-sm">
                  {new Date(payment.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </p>
                <div className="order-4 justify-self-end sm:order-none sm:justify-self-start">
                  {/* a completed payment is money received: positive, as before (events use "completed" as neutral) */}
                  <Pill tone={statusTone(payment.status === "COMPLETED" ? "completed_payment" : payment.status)}>{statusLabel(payment.status)}</Pill>
                </div>
                <p className="order-2 text-right text-sm font-medium tabular-nums sm:order-none">
                  ₹{payment.amount.toLocaleString("en-IN")}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <EmptyState
          icon={CreditCard}
          title="No payments yet"
          description="Your payment history will appear here when you register for paid events."
        />
      )}
    </div>
  )
}
