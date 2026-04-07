"use client"

import { useState } from "react"
import { type ColumnDef } from "@tanstack/react-table"
import { Award, Plus, Download, Send, MoreHorizontal, FileText } from "lucide-react"
import Link from "next/link"

import { PageHeader } from "@/components/shared/PageHeader"
import { DataTable } from "@/components/tables/DataTable"
import { Card } from "@/components/ui/card"
import { Button, buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/permissions"
import { cn } from "@/lib/utils"

interface CertRow {
  id: string
  certificateNumber: string
  recipientName: string
  recipientEmail: string
  eventTitle: string
  type: string
  status: string
  issuedDate: string
}

const typeColors: Record<string, string> = {
  PARTICIPATION: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  WINNER: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  RUNNER_UP: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  VOLUNTEER: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  SPEAKER: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
}

const columns: ColumnDef<CertRow, unknown>[] = [
  {
    accessorKey: "recipientName", header: "Recipient",
    cell: ({ row }) => (<div><p className="font-medium">{row.original.recipientName}</p><p className="text-xs text-muted-foreground">{row.original.recipientEmail}</p></div>),
  },
  { accessorKey: "eventTitle", header: "Event", cell: ({ getValue }) => <span className="text-sm">{getValue() as string}</span> },
  { accessorKey: "certificateNumber", header: "Certificate #", cell: ({ getValue }) => <span className="text-sm font-mono">{getValue() as string}</span> },
  {
    accessorKey: "type", header: "Type",
    cell: ({ getValue }) => { const t = getValue() as string; return <Badge variant="secondary" className={typeColors[t] || ""}>{t}</Badge> },
  },
  {
    accessorKey: "status", header: "Status",
    cell: ({ getValue }) => {
      const s = getValue() as string
      return <Badge variant={s === "DOWNLOADED" ? "default" : "secondary"}>{s}</Badge>
    },
  },
  { accessorKey: "issuedDate", header: "Issued", cell: ({ getValue }) => <span className="text-sm text-muted-foreground">{getValue() as string}</span> },
  {
    id: "actions",
    cell: () => (
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}><MoreHorizontal className="h-4 w-4" /></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>Preview</DropdownMenuItem>
          <DropdownMenuItem>Download PDF</DropdownMenuItem>
          <DropdownMenuItem>Resend Email</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive">Revoke</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
]

export default function CertificatesPage() {
  const [page, setPage] = useState(1)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Certificates"
        description="Create and manage event certificates"
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Organization", href: "/admin/org" }, { label: "Certificates" }]}
        actions={
          <PermissionGate permission={PERMISSIONS.CERTIFICATE_CREATE_TEMPLATE}>
            <Link href="/admin/org/certificates/templates/create" className={cn(buttonVariants(), "gap-2")}>
              <Plus className="h-4 w-4" /> Create Template
            </Link>
          </PermissionGate>
        }
      />

      <Tabs defaultValue="templates">
        <TabsList>
          <TabsTrigger value="templates" className="gap-1"><FileText className="h-3.5 w-3.5" /> Templates</TabsTrigger>
          <TabsTrigger value="issued" className="gap-1"><Award className="h-3.5 w-3.5" /> Issued</TabsTrigger>
          <TabsTrigger value="pending" className="gap-1">Pending</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="mt-4">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { name: "Certificate of Participation", type: "Participation", isDefault: true },
              { name: "Certificate of Achievement", type: "Achievement" },
              { name: "Certificate of Appreciation", type: "Appreciation" },
            ].map((t) => (
              <Card key={t.name} className="p-4 space-y-3 hover:shadow-md transition-shadow">
                <div className="h-32 rounded bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/30 dark:to-amber-900/20 flex items-center justify-center">
                  <Award className="h-12 w-12 text-amber-500/50" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{t.name}</p>
                    {t.isDefault && <Badge variant="secondary" className="text-[9px]">Default</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{t.type}</p>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="issued" className="mt-4">
          <DataTable
            columns={columns} data={[]} isLoading={false}
            pagination={{ page, pageSize: 10, total: 0 }} onPaginationChange={(p) => setPage(p)}
            emptyState={
              <div className="text-center py-4">
                <Award className="mx-auto h-10 w-10 text-muted-foreground/30 mb-2" />
                <p className="font-medium">No certificates issued yet</p>
                <p className="text-sm text-muted-foreground">Generate certificates for completed events.</p>
              </div>
            }
          />
        </TabsContent>

        <TabsContent value="pending" className="mt-4">
          <Card className="p-8 text-center">
            <Award className="mx-auto h-10 w-10 text-muted-foreground/30 mb-2" />
            <p className="font-medium">No pending certificate generation</p>
            <p className="text-sm text-muted-foreground mt-1">Completed events without certificates will appear here.</p>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
