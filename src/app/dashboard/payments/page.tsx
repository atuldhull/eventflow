"use client"

import { useState, useEffect } from "react"
import Link from "next/link"

import { PageHeader } from "@/components/shared/PageHeader"
import { buttonVariants } from "@/components/ui/button"
import { DashEmpty } from "../_components/bits"
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
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
        </div>
      ) : payments.length > 0 ? (
        <div className="overflow-hidden rounded-xl border bg-card">
          <table className="w-full text-sm">
            <caption className="sr-only">Your payments</caption>
            <thead>
              <tr className="border-b border-rule text-left text-xs text-muted-foreground">
                <th scope="col" className="px-4 py-3 font-medium">Event</th>
                <th scope="col" className="hidden w-36 px-4 py-3 font-medium sm:table-cell">Date</th>
                <th scope="col" className="hidden w-32 px-4 py-3 font-medium sm:table-cell">Status</th>
                <th scope="col" className="w-32 px-4 py-3 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {payments.map((payment) => {
                const date = new Date(payment.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                // a completed payment is money received: positive, as before (events use "completed" as neutral)
                const pill = (
                  <Pill tone={statusTone(payment.status === "COMPLETED" ? "completed_payment" : payment.status)}>{statusLabel(payment.status)}</Pill>
                )
                return (
                  <tr key={payment.id} className="align-middle transition-colors hover:bg-muted/50">
                    <td className="max-w-0 px-4 py-3.5">
                      <p className="truncate font-medium">{payment.event?.title || "Event Payment"}</p>
                      <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
                        {payment.method}
                        {/* on phones the date rides under the event */}
                        <span className="sm:hidden">
                          {payment.method && " · "}
                          <span className="tabular-nums">{date}</span>
                        </span>
                      </p>
                    </td>
                    <td className="hidden px-4 py-3.5 text-muted-foreground tabular-nums sm:table-cell">{date}</td>
                    <td className="hidden px-4 py-3.5 sm:table-cell">{pill}</td>
                    <td className="px-4 py-3.5 text-right">
                      <span className="font-display text-[16px] font-bold tracking-[-0.01em] tabular-nums">
                        ₹{payment.amount.toLocaleString("en-IN")}
                      </span>
                      <span className="mt-1 flex justify-end sm:hidden">{pill}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <DashEmpty
          title="No payments yet"
          description="Your payment history will appear here when you register for paid events."
        >
          <Link href="/events" className={buttonVariants()}>Browse events</Link>
        </DashEmpty>
      )}
    </div>
  )
}
