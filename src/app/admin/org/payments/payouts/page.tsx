import { IndianRupee, Clock, CheckCircle } from "lucide-react"
import { PageHeader } from "@/components/shared/PageHeader"
import { StatCard } from "@/components/shared/StatCard"
import { Card } from "@/components/ui/card"

export default function PayoutsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Payouts"
        description="Track your earnings and settlements"
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Organization", href: "/admin/org" },
          { label: "Payments", href: "/admin/org/payments" },
          { label: "Payouts" },
        ]}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          title="Available Balance"
          value="₹0"
          icon={IndianRupee}
          iconColor="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
        />
        <StatCard
          title="Next Payout"
          value="—"
          icon={Clock}
          iconColor="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
          description="T+2 settlement"
        />
        <StatCard
          title="Last Payout"
          value="₹0"
          icon={CheckCircle}
          iconColor="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
        />
      </div>

      <Card className="p-6">
        <h3 className="text-sm font-medium mb-4">Payout History</h3>
        <p className="text-sm text-muted-foreground text-center py-8">
          Payout history will appear here once payment settlements are processed.
        </p>
      </Card>

      <Card className="p-6">
        <h3 className="text-sm font-medium mb-4">Platform Fees</h3>
        <div className="text-sm text-muted-foreground text-center py-4">
          <p>Platform fee rate: 2% per transaction</p>
          <p className="mt-1">Total fees to date: ₹0</p>
        </div>
      </Card>
    </div>
  )
}
