"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useSession } from "next-auth/react"
import { type ColumnDef } from "@tanstack/react-table"
import { Loader2, MoreHorizontal } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/PageHeader"
import { KpiStrip } from "@/components/shared/StatCard"
import { DataTable } from "@/components/tables/DataTable"
import { Button } from "@/components/ui/button"
import { Pill } from "@/components/ui/pill"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { getRoleDescription, getRoleLabel } from "@/lib/permissions"
import { ROLES, type Role } from "@/lib/constants"
import { useDebounce } from "@/hooks/useDebounce"
import { SearchField, TableEmpty, Initial, PrimaryCell, fmtDateTime, num } from "@/app/admin/enterprise/_components/admin-ui"

interface UserRow {
  id: string
  name: string
  email: string
  phone: string | null
  role: Role
  isActive: boolean
  isBanned: boolean
  banReason: string | null
  lastLoginAt: string | null
  createdAt: string
}

const ALL_ROLES = Object.values(ROLES) as Role[]

// what GET /api/super-admin/users understands ("" = all)
const ROLE_FILTERS = [{ value: "", label: "All roles" }, ...ALL_ROLES.map((r) => ({ value: r, label: getRoleLabel(r) }))]
const STATUS_FILTERS = [
  { value: "", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "banned", label: "Banned" },
]

export default function UsersPage() {
  const { data: session } = useSession()
  const myId = session?.user?.id
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const debouncedSearch = useDebounce(search)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [data, setData] = useState<UserRow[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0, active: 0, banned: 0, newThisMonth: 0 })

  const [roleTarget, setRoleTarget] = useState<UserRow | null>(null)
  const [newRole, setNewRole] = useState("")
  const [banTarget, setBanTarget] = useState<UserRow | null>(null)
  const [banReason, setBanReason] = useState("")
  const [mutating, setMutating] = useState(false)

  const fetchUsers = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(pageSize) })
      if (debouncedSearch) params.set("search", debouncedSearch)
      if (roleFilter) params.set("role", roleFilter)
      if (statusFilter) params.set("status", statusFilter)
      const res = await fetch(`/api/super-admin/users?${params}`)
      const json = await res.json()
      if (json.success) {
        setData(json.data)
        setTotal(json.pagination?.total || 0)
        if (json.stats) setStats(json.stats)
      } else toast.error(json.message || "Failed to load users")
    } catch { toast.error("Failed to load users") }
    finally { setIsLoading(false) }
  }, [page, pageSize, debouncedSearch, roleFilter, statusFilter])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const submitRole = async () => {
    if (!roleTarget || !newRole) return
    setMutating(true)
    try {
      const res = await fetch(`/api/super-admin/users/${roleTarget.id}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      })
      const json = await res.json().catch(() => null)
      if (!json?.success) { toast.error(json?.message || "Failed to change role"); return }
      toast.success(`${roleTarget.name} is now ${getRoleLabel(newRole as Role)}`)
      setRoleTarget(null)
      fetchUsers()
    } catch {
      toast.error("Failed to change role")
    } finally {
      setMutating(false)
    }
  }

  const submitBan = async () => {
    if (!banTarget) return
    setMutating(true)
    try {
      const res = await fetch(`/api/super-admin/users/${banTarget.id}/ban`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(banTarget.isBanned || !banReason.trim() ? {} : { reason: banReason.trim() }),
      })
      const json = await res.json().catch(() => null)
      if (!json?.success) { toast.error(json?.message || "Failed to update user"); return }
      toast.success(json.message)
      setBanTarget(null)
      fetchUsers()
    } catch {
      toast.error("Failed to update user")
    } finally {
      setMutating(false)
    }
  }

  const columns = useMemo<ColumnDef<UserRow, unknown>[]>(() => [
    {
      accessorKey: "name",
      header: "User",
      cell: ({ row }) => (
        <div className="flex min-w-0 items-center gap-3">
          <Initial name={row.original.name} />
          <PrimaryCell title={row.original.name} meta={row.original.email}>
            {row.original.id === myId && <Pill>You</Pill>}
          </PrimaryCell>
        </div>
      ),
      meta: { className: "min-w-[220px] max-w-[320px]" },
    },
    {
      accessorKey: "phone",
      header: "Phone",
      cell: ({ getValue }) => {
        const phone = getValue() as string | null
        return phone ? <span className="tabular-nums">{phone}</span> : <span className="text-faint">—</span>
      },
    },
    {
      accessorKey: "role",
      header: "Role",
      cell: ({ row }) => <Pill>{getRoleLabel(row.original.role)}</Pill>,
    },
    {
      accessorKey: "isBanned",
      header: "Status",
      cell: ({ row }) => {
        const u = row.original
        const label = u.isBanned ? "Banned" : u.isActive ? "Active" : "Inactive"
        return (
          <span title={u.isBanned && u.banReason ? `Reason: ${u.banReason}` : undefined}>
            <Pill tone={u.isBanned ? "negative" : u.isActive ? "positive" : "neutral"}>{label}</Pill>
          </span>
        )
      },
    },
    {
      accessorKey: "lastLoginAt",
      header: "Last sign-in",
      cell: ({ getValue }) => {
        const date = getValue() as string | null
        return <span className="text-muted-foreground tabular-nums">{date ? fmtDateTime(date) : "Never"}</span>
      },
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const u = row.original
        // the APIs refuse both: no changing your own role, no banning a super admin or yourself
        if (u.id === myId) return null
        const canBan = u.role !== "SUPER_ADMIN"
        return (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${u.name}`} />}>
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => { setNewRole(u.role); setRoleTarget(u) }}>Change role</DropdownMenuItem>
              {canBan && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant={u.isBanned ? "default" : "destructive"} onClick={() => { setBanReason(""); setBanTarget(u) }}>
                    {u.isBanned ? "Unban user" : "Ban user"}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
      meta: { align: "right", className: "w-12" },
    },
  ], [myId])

  return (
    <div className="space-y-6">
      <PageHeader title="Users" description="Every account on the platform" />

      <KpiStrip
        isLoading={isLoading && stats.total === 0}
        items={[
          { label: "Total users", value: num(stats.total) },
          { label: "Active", value: num(stats.active), caption: "Not banned" },
          { label: "Banned", value: num(stats.banned) },
          { label: "New this month", value: num(stats.newThisMonth) },
        ]}
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchField value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Search by name, email or phone…" className="sm:max-w-sm" />
        <Select items={ROLE_FILTERS} value={roleFilter} onValueChange={(v) => { setRoleFilter((v as string) || ""); setPage(1) }}>
          <SelectTrigger aria-label="Filter by role" className="w-full sm:w-48 data-[size=default]:h-9">
            <SelectValue placeholder="All roles" />
          </SelectTrigger>
          <SelectContent>
            {ROLE_FILTERS.map((r) => <SelectItem key={r.value || "all"} value={r.value}>{r.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select items={STATUS_FILTERS} value={statusFilter} onValueChange={(v) => { setStatusFilter((v as string) || ""); setPage(1) }}>
          <SelectTrigger aria-label="Filter by status" className="w-full sm:w-40 data-[size=default]:h-9">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((s) => <SelectItem key={s.value || "all"} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        pagination={{ page, pageSize, total }}
        onPaginationChange={(p, ps) => { setPage(p); setPageSize(ps) }}
        emptyState={
          <TableEmpty
            title={debouncedSearch || roleFilter || statusFilter ? "No matching users" : "No users yet"}
            description={debouncedSearch || roleFilter || statusFilter ? "Try a different search or filter." : "Users will appear here once they sign up."}
          />
        }
      />

      {/* Change role */}
      <Dialog open={!!roleTarget} onOpenChange={(open) => { if (!open && !mutating) setRoleTarget(null) }}>
        <DialogContent className="sm:max-w-[440px]">
          <form noValidate onSubmit={(e) => { e.preventDefault(); submitRole() }} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Change {roleTarget?.name}&apos;s platform role</DialogTitle>
              <DialogDescription>
                This is the account-wide role. Roles inside an enterprise or organization are set on its Members page.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-1.5">
              <Label htmlFor="user-role">Role</Label>
              <Select items={ALL_ROLES.map((r) => ({ value: r, label: getRoleLabel(r) }))} value={newRole} onValueChange={(v) => setNewRole((v as string) || "")}>
                <SelectTrigger id="user-role" className="w-full data-[size=default]:h-9">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {ALL_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      <span className="font-medium">{getRoleLabel(r)}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{getRoleDescription(r)}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {newRole === "SUPER_ADMIN" && roleTarget?.role !== "SUPER_ADMIN" && (
                <p className="text-xs text-warning">Super admins can see and change everything on the platform.</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRoleTarget(null)} disabled={mutating}>Cancel</Button>
              <Button type="submit" disabled={mutating || !newRole || newRole === roleTarget?.role}>
                {mutating && <Loader2 className="animate-spin" />}
                Save role
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Ban / unban */}
      <Dialog open={!!banTarget} onOpenChange={(open) => { if (!open && !mutating) setBanTarget(null) }}>
        <DialogContent className="sm:max-w-[440px]">
          <form noValidate onSubmit={(e) => { e.preventDefault(); submitBan() }} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>{banTarget?.isBanned ? `Unban ${banTarget?.name}?` : `Ban ${banTarget?.name}?`}</DialogTitle>
              <DialogDescription>
                {banTarget?.isBanned
                  ? "They will be able to sign in again."
                  : "They are signed out within a few minutes and can't sign in until unbanned."}
              </DialogDescription>
            </DialogHeader>
            {!banTarget?.isBanned && (
              <div className="grid gap-1.5">
                <Label htmlFor="ban-reason">Reason <span className="font-normal text-muted-foreground">(optional, kept in the audit log)</span></Label>
                <Textarea id="ban-reason" rows={2} maxLength={500} value={banReason} onChange={(e) => setBanReason(e.target.value)} />
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setBanTarget(null)} disabled={mutating}>Cancel</Button>
              <Button type="submit" variant={banTarget?.isBanned ? "default" : "destructive"} disabled={mutating}>
                {mutating && <Loader2 className="animate-spin" />}
                {banTarget?.isBanned ? "Unban user" : "Ban user"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
