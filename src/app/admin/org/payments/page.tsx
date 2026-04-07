"use client"

import { useState } from "react"
import { type ColumnDef } from "@tanstack/react-table"
import { CreditCard, Download, IndianRupee, TrendingUp, ArrowDownRight } from "lucide-react"

import { PageHeader } from "@/components/shared/PageHeader"
import { StatCard } from "@/components/shared/StatCard"
import { DataTable } from "@/components/tables/DataTable"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/permissions"
import { useDebounce } from "@/hooks/useDebounce"

interface PaymentRow {
  id: string
  paymentNumber: string
  participantName: string
  eventTitle: string
  amount: number
  status: string
  method: string
  createdAt: string
}

const statusColors: Record<string, string> = {
  COMPLETED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  FAILED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  REFUNDED: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
}

const columns: ColumnDef<PaymentRow, unknown>[] = [
  { accessorKey: "paymentNumber", header: "Payment #", cell: ({ getValue }) => <span className="text-sm font-mono">{getValue() as string}</span> },
  { accessorKey: "participantName", header: "Participant", cell: ({ getValue }) => <span className="text-sm">{getValue() as string}</span> },
  { accessorKey: "eventTitle", header: "Event", cell: ({ getValue }) => <span className="text-sm">{getValue() as string}</span> },
  { accessorKey: "amount", header: "Amount", cell: ({ getValue }) => <span className="text-sm font-medium">₹{(getValue() as number).toLocaleString()}</span> },
  {
    accessorKey: "status", header: "Status",
    cell: ({ getValue }) => { const s = getValue() as string; return <Badge variant="secondary" className={statusColors[s] || ""}>{s}</Badge> },
  },
  { accessorKey: "method", header: "Method", cell: ({ getValue }) => <Badge variant="outline">{getValue() as string}</Badge> },
  { accessorKey: "createdAt", header: "Date", cell: ({ getValue }) => <span className="text-sm text-muted-foreground">{getValue() as string}</span> },
]

export default function OrgPaymentsPage() {
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search)
  const [page, setPage] = useState(1)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments & Finance"
        description="Financial overview of your organization"
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Organization", href: "/admin/org" }, { label: "Payments" }]}
        actions={<PermissionGate permission={PERMISSIONS.PAYMENT_EXPORT}><Button variant="outline" className="gap-2"><Download className="h-4 w-4" /> Export</Button></PermissionGate>}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Revenue" value="₹0" icon={IndianRupee} iconColor="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" />
        <StatCard title="This Month" value="₹0" icon={TrendingUp} iconColor="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" />
        <StatCard title="Refunds" value="₹0" icon={ArrowDownRight} iconColor="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" />
        <StatCard title="Pending" value="0" icon={CreditCard} iconColor="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" />
      </div>

      <Tabs defaultValue="payments">
        <TabsList><TabsTrigger value="payments">Payments</TabsTrigger><TabsTrigger value="coupons">Coupons</TabsTrigger></TabsList>
        <TabsContent value="payments" className="mt-4 space-y-4">
          <Input placeholder="Search payments..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
          <DataTable columns={columns} data={[]} isLoading={false} pagination={{ page, pageSize: 10, total: 0 }} onPaginationChange={(p) => setPage(p)}
            emptyState={<div className="text-center py-4"><CreditCard className="mx-auto h-10 w-10 text-muted-foreground/30 mb-2" /><p className="font-medium">No payments yet</p></div>}
          />
        </TabsContent>
        <TabsContent value="coupons" className="mt-4">
          <Card className="p-8 text-center text-muted-foreground">
            <p className="font-medium">No coupons yet</p>
            <p className="text-sm mt-1">Create coupons to offer discounts on event tickets.</p>
            <PermissionGate permission={PERMISSIONS.COUPON_CREATE}>
              <Button className="mt-3">Create Coupon</Button>
            </PermissionGate>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
