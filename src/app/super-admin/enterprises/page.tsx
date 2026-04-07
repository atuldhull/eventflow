"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { type ColumnDef } from "@tanstack/react-table"
import { Building2, Plus, MoreHorizontal, CheckCircle } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/PageHeader"
import { DataTable } from "@/components/tables/DataTable"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { useDebounce } from "@/hooks/useDebounce"

interface Enterprise {
  id: string
  name: string
  slug: string
  type: string | null
  email: string
  isActive: boolean
  isVerified: boolean
  createdAt: string
  _count: { organizations: number; events: number; members: number }
  owner: { name: string }
}

const columns: ColumnDef<Enterprise, unknown>[] = [
  {
    accessorKey: "name",
    header: "Enterprise",
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
          <Building2 className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="font-medium">{row.original.name}</p>
          <p className="text-xs text-muted-foreground">{row.original.slug}</p>
        </div>
      </div>
    ),
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ getValue }) => {
      const type = getValue() as string | null
      return type ? <Badge variant="secondary">{type}</Badge> : <span className="text-muted-foreground">—</span>
    },
  },
  {
    accessorKey: "owner",
    header: "Owner",
    cell: ({ row }) => <span className="text-sm">{row.original.owner?.name || "—"}</span>,
  },
  {
    id: "orgs",
    header: "Orgs",
    cell: ({ row }) => row.original._count?.organizations ?? 0,
  },
  {
    id: "events",
    header: "Events",
    cell: ({ row }) => row.original._count?.events ?? 0,
  },
  {
    accessorKey: "isActive",
    header: "Status",
    cell: ({ row }) => (
      <div className="flex items-center gap-1.5">
        <Badge variant={row.original.isActive ? "default" : "secondary"}>
          {row.original.isActive ? "Active" : "Inactive"}
        </Badge>
        {row.original.isVerified && (
          <CheckCircle className="h-3.5 w-3.5 text-green-500" />
        )}
      </div>
    ),
  },
  {
    id: "actions",
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>View Details</DropdownMenuItem>
          <DropdownMenuItem>Edit</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem>{row.original.isVerified ? "Unverify" : "Verify"}</DropdownMenuItem>
          <DropdownMenuItem>{row.original.isActive ? "Deactivate" : "Activate"}</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
]

export default function EnterprisesPage() {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [data, setData] = useState<Enterprise[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  // Create dialog state
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: "", slug: "", email: "", type: "", description: "" })

  const fetchEnterprises = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(pageSize) })
      if (debouncedSearch) params.set("search", debouncedSearch)
      const res = await fetch(`/api/super-admin/enterprises?${params}`)
      const json = await res.json()
      if (json.success) {
        setData(json.data)
        setTotal(json.pagination.total)
      }
    } catch {
      toast.error("Failed to load enterprises")
    } finally {
      setIsLoading(false)
    }
  }, [page, pageSize, debouncedSearch])

  useEffect(() => { fetchEnterprises() }, [fetchEnterprises])

  const handleCreate = async () => {
    if (!form.name || !form.email) { toast.error("Name and email are required"); return }
    setCreating(true)
    try {
      const res = await fetch("/api/super-admin/enterprises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          slug: form.slug || form.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
          ownerId: "current", // will be resolved server-side
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success("Enterprise created!")
        setShowCreate(false)
        setForm({ name: "", slug: "", email: "", type: "", description: "" })
        fetchEnterprises()
      } else {
        toast.error(json.message || "Failed to create")
      }
    } catch {
      toast.error("Failed to create enterprise")
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Enterprises"
        description="Manage all enterprises on the platform"
        breadcrumbs={[
          { label: "Super Admin", href: "/super-admin" },
          { label: "Enterprises" },
        ]}
        actions={
          <Button className="gap-2" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            Add Enterprise
          </Button>
        }
      />

      <div className="flex gap-4">
        <Input
          placeholder="Search enterprises..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        pagination={{ page, pageSize, total }}
        onPaginationChange={(p, ps) => { setPage(p); setPageSize(ps) }}
        emptyState={
          <div className="text-center py-4">
            <Building2 className="mx-auto h-10 w-10 text-muted-foreground/30 mb-2" />
            <p className="font-medium">No enterprises yet</p>
            <p className="text-sm text-muted-foreground">Create your first enterprise to get started.</p>
          </div>
        }
      />

      {/* Create Enterprise Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Enterprise</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Demo University" />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="auto-generated from name" />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="admin@enterprise.com" />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Input value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} placeholder="UNIVERSITY, COMPANY, etc." />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Brief description" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating}>{creating ? "Creating..." : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
