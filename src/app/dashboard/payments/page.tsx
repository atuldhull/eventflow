"use client"

import { CreditCard } from "lucide-react"
import { PageHeader } from "@/components/shared/PageHeader"

export default function MyPaymentsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="My Payments" description="Your payment history" />

      <div className="text-center py-16">
        <CreditCard className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
        <p className="font-medium">No payments yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          Your payment history will appear here when you register for paid events.
        </p>
      </div>
    </div>
  )
}
