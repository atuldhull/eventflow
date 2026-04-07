"use client"

import { useState, useEffect } from "react"
import { CreditCard, Loader2, IndianRupee, Download } from "lucide-react"
import { PageHeader } from "@/components/shared/PageHeader"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

interface Payment {
  id: string
  amount: number
  currency: string
  status: string
  method: string | null
  createdAt: string
  event: { title: string; slug: string }
}

const statusColors: Record<string, string> = {
  COMPLETED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  FAILED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  REFUNDED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
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

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>

  return (
    <div className="space-y-6">
      <PageHeader title="My Payments" description="Your payment history" />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Total Spent</p>
          <p className="text-2xl font-bold">₹{totalSpent.toLocaleString("en-IN")}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Transactions</p>
          <p className="text-2xl font-bold">{payments.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Refunds</p>
          <p className="text-2xl font-bold">{payments.filter(p => p.status === "REFUNDED").length}</p>
        </Card>
      </div>

      {payments.length > 0 ? (
        <div className="space-y-2">
          {payments.map((payment) => (
            <Card key={payment.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">{payment.event?.title || "Event Payment"}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(payment.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    {payment.method && ` · ${payment.method}`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className={statusColors[payment.status] || ""}>{payment.status}</Badge>
                  <p className="text-sm font-bold">₹{payment.amount.toLocaleString("en-IN")}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <CreditCard className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="font-medium">No payments yet</p>
          <p className="text-sm text-muted-foreground mt-1">Your payment history will appear here when you register for paid events.</p>
        </div>
      )}
    </div>
  )
}
