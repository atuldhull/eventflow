"use client"

import { useState, useEffect } from "react"
import { type ColumnDef } from "@tanstack/react-table"
import { Users, MoreHorizontal, Shield, Ban } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/PageHeader"
import { StatCard } from "@/components/shared/StatCard"
import { DataTable } from "@/components/tables/DataTable"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { getRoleLabel, getRoleColor } from "@/lib/permissions"
import { useDebounce } from "@/hooks/useDebounce"
import type { Role } from "@/lib/constants"

interface UserRow {
  id: string
  name: string
  email: string
  phone: string | null
  role: Role
  isActive: boolean
  isBanned: boolean
  lastLoginAt: string | null
  createdAt: string
}

const columns: ColumnDef<UserRow, unknown>[] = [
  {
    accessorKey: "name",
    header: "User",
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-medium">
          {row.original.name?.[0]?.toUpperCase() || "?"}
        </div>
        <div>
          <p className="font-medium">{row.original.name}</p>
          <p className="text-xs text-muted-foreground">{row.original.email}</p>
        </div>
      </div>
    ),
  },
  {
    accessorKey: "phone",
    header: "Phone",
    cell: ({ getValue }) => {
      const phone = getValue() as string | null
      return <span className="text-sm">{phone || "—"}</span>
    },
  },
  {
    accessorKey: "role",
    header: "Role",
    cell: ({ row }) => (
      <Badge variant="secondary" className={getRoleColor(row.original.role)}>
        {getRoleLabel(row.original.role)}
      </Badge>
    ),
  },
  {
    accessorKey: "isBanned",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant={row.original.isBanned ? "destructive" : "default"}>
        {row.original.isBanned ? "Banned" : "Active"}
      </Badge>
    ),
  },
  {
    accessorKey: "lastLoginAt",
    header: "Last Login",
    cell: ({ getValue }) => {
      const date = getValue() as string | null
      return <span className="text-sm text-muted-foreground">{date || "Never"}</span>
    },
  },
  {
    id: "actions",
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>View Profile</DropdownMenuItem>
          <DropdownMenuItem>Change Role</DropdownMenuItem>
          <DropdownMenuItem>Reset Password</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive">
            {row.original.isBanned ? "Unban User" : "Ban User"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
]

export default function UsersPage() {
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [data, setData] = useState<UserRow[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0, active: 0, banned: 0, newThisMonth: 0 })

  useEffect(() => {
    async function fetchUsers() {
      setIsLoading(true)
      try {
        const params = new URLSearchParams({ page: String(page), limit: String(pageSize) })
        if (debouncedSearch) params.set("search", debouncedSearch)
        const res = await fetch(`/api/super-admin/users?${params}`)
        const json = await res.json()
        if (json.success) {
          setData(json.data)
          setTotal(json.pagination?.total || 0)
          if (json.stats) setStats(json.stats)
        }
      } catch { toast.error("Failed to load users") }
      finally { setIsLoading(false) }
    }
    fetchUsers()
  }, [page, pageSize, debouncedSearch])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Manage all users on the platform"
        breadcrumbs={[
          { label: "Super Admin", href: "/super-admin" },
          { label: "Users" },
        ]}
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard title="Total Users" value={String(stats.total || total)} icon={Users} iconColor="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" />
        <StatCard title="Active" value={String(stats.active)} icon={Shield} iconColor="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" />
        <StatCard title="Banned" value={String(stats.banned)} icon={Ban} iconColor="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" />
        <StatCard title="New This Month" value={String(stats.newThisMonth)} icon={Users} iconColor="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" />
      </div>

      <div className="flex gap-4">
        <Input
          placeholder="Search users by name, email, or phone..."
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
        enableRowSelection
        emptyState={
          <div className="text-center py-4">
            <Users className="mx-auto h-10 w-10 text-muted-foreground/30 mb-2" />
            <p className="font-medium">No users yet</p>
            <p className="text-sm text-muted-foreground">Users will appear here once they sign up.</p>
          </div>
        }
      />
    </div>
  )
}
