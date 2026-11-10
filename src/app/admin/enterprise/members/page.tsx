"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { type ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal, UserPlus, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/PageHeader"
import { DataTable } from "@/components/tables/DataTable"
import { Button } from "@/components/ui/button"
import { Pill } from "@/components/ui/pill"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS, getAssignableEnterpriseRoles, getRoleLabel, getRoleDescription } from "@/lib/permissions"
import { useRBAC } from "@/hooks/useRBAC"
import { usePermissions } from "@/hooks/usePermissions"
import { useDebounce } from "@/hooks/useDebounce"
import type { Role } from "@/lib/constants"
import { SearchField, TableEmpty, PrimaryCell, Initial, fmtDate, fmtDateTime, num } from "../_components/admin-ui"
import { InviteMemberDialog } from "../_components/invite-member-dialog"

interface MemberRow {
  id: string
  userId: string
  name: string
  email: string
  role: Role
  isActive: boolean
  joinedAt: string
  updatedAt: string
  lastLoginAt: string | null
  isOwner: boolean
  isSelf: boolean
  canManage: boolean
}

interface InviteRow {
  email: string
  role: Role
  invitedAt: string
  invitedByName: string | null
  canManage: boolean
}

/** What the members API says about the caller, from their role IN this enterprise. */
interface Viewer { role: Role; isOwner: boolean; canInvite: boolean; assignableRoles: Role[] }

type Status = "active" | "inactive" | "pending"
const PAGE_SIZE = 10

async function send(url: string, method: string, body: unknown): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    const json = await res.json().catch(() => null)
    return { ok: !!json?.success, message: json?.message || "Something went wrong" }
  } catch {
    return { ok: false, message: "Couldn't reach the server" }
  }
}

export default function EnterpriseMembersPage() {
  const { currentEnterpriseId, enterpriseRole, isEnterpriseOwner } = useRBAC()
  const { hasPermission } = usePermissions()
  const [status, setStatus] = useState<Status>("active")
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search)
  const [page, setPage] = useState(1)
  const [members, setMembers] = useState<MemberRow[]>([])
  const [invites, setInvites] = useState<InviteRow[]>([])
  const [total, setTotal] = useState(0)
  const [counts, setCounts] = useState({ active: 0, inactive: 0, pending: 0 })
  const [viewer, setViewer] = useState<Viewer | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [inviteOpen, setInviteOpen] = useState(false)

  const [roleTarget, setRoleTarget] = useState<MemberRow | null>(null)
  const [newRole, setNewRole] = useState("")
  const [removeTarget, setRemoveTarget] = useState<MemberRow | null>(null)
  const [cancelTarget, setCancelTarget] = useState<InviteRow | null>(null)
  const [mutating, setMutating] = useState(false)
  const [busyEmail, setBusyEmail] = useState<string | null>(null)

  const canChangeRole = hasPermission(PERMISSIONS.MEMBER_CHANGE_ROLE)
  const canRemove = hasPermission(PERMISSIONS.MEMBER_REMOVE)
  const canInvite = hasPermission(PERMISSIONS.MEMBER_INVITE)
  // Roles come from the caller's role IN this enterprise (never their global role): the
  // members API answers with them; until it has, the same rule from the permissions lookup.
  const assignableRoles = viewer?.assignableRoles ?? getAssignableEnterpriseRoles(enterpriseRole, isEnterpriseOwner)

  const fetchMembers = useCallback(async () => {
    if (!currentEnterpriseId) return
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE), status })
      if (debouncedSearch) params.set("search", debouncedSearch)
      const res = await fetch(`/api/admin/enterprise/${currentEnterpriseId}/members?${params}`)
      const json = await res.json()
      if (json.success) {
        if (status === "pending") { setInvites(json.data); setMembers([]) }
        else { setMembers(json.data); setInvites([]) }
        setTotal(json.pagination.total)
        setCounts(json.counts)
        setViewer(json.viewer ?? null)
      } else {
        toast.error(json.message || "Failed to load members")
      }
    } catch {
      toast.error("Failed to load members")
    } finally {
      setIsLoading(false)
    }
  }, [currentEnterpriseId, page, status, debouncedSearch])

  useEffect(() => { fetchMembers() }, [fetchMembers])

  const entity = useMemo(() => ({ entityType: "ENTERPRISE", entityId: currentEnterpriseId }), [currentEnterpriseId])

  const submitRole = async () => {
    if (!roleTarget || !newRole || !currentEnterpriseId) return
    setMutating(true)
    const r = await send(`/api/members/${roleTarget.id}/role`, "PATCH", { role: newRole, ...entity })
    setMutating(false)
    if (!r.ok) { toast.error(r.message); return }
    toast.success(r.message)
    setRoleTarget(null)
    fetchMembers()
  }

  const submitRemove = async () => {
    if (!removeTarget || !currentEnterpriseId) return
    setMutating(true)
    const r = await send(`/api/members/${removeTarget.id}/remove`, "DELETE", entity)
    setMutating(false)
    if (!r.ok) { toast.error(r.message); return }
    toast.success(r.message)
    setRemoveTarget(null)
    fetchMembers()
  }

  const submitCancel = async () => {
    if (!cancelTarget || !currentEnterpriseId) return
    setMutating(true)
    const r = await send(`/api/admin/enterprise/${currentEnterpriseId}/members/invites`, "DELETE", { email: cancelTarget.email })
    setMutating(false)
    if (!r.ok) { toast.error(r.message); return }
    toast.success("Invitation cancelled")
    setCancelTarget(null)
    fetchMembers()
  }

  // Resend a pending invitation, or bring a removed member back with their old role
  const reinvite = useCallback(async (email: string, role: Role, kind: "resend" | "restore") => {
    setBusyEmail(email)
    const r = await send("/api/members/invite", "POST", { email, role, ...entity })
    setBusyEmail(null)
    if (!r.ok) { toast.error(r.message); return }
    toast.success(
      kind === "restore" ? `${email} is a member again`
        : r.message === "Member added successfully." ? `${email} has an account now and was added` : "Invitation sent again"
    )
    fetchMembers()
  }, [entity, fetchMembers])

  const memberColumns = useMemo<ColumnDef<MemberRow, unknown>[]>(() => [
    {
      accessorKey: "name",
      header: "Member",
      cell: ({ row }) => (
        <div className="flex min-w-0 items-center gap-3">
          <Initial name={row.original.name} />
          <PrimaryCell title={row.original.name} meta={row.original.email}>
            {row.original.isOwner && <Pill tone="brand">Owner</Pill>}
            {row.original.isSelf && <Pill>You</Pill>}
          </PrimaryCell>
        </div>
      ),
      meta: { className: "min-w-[240px] max-w-[360px]" },
    },
    {
      accessorKey: "role",
      header: "Role",
      cell: ({ row }) => <Pill>{getRoleLabel(row.original.role)}</Pill>,
    },
    {
      accessorKey: "joinedAt",
      header: status === "active" ? "Joined" : "Removed",
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">
          {fmtDate(status === "active" ? row.original.joinedAt : row.original.updatedAt, true)}
        </span>
      ),
    },
    {
      accessorKey: "lastLoginAt",
      header: "Last sign-in",
      cell: ({ getValue }) => {
        const v = getValue() as string | null
        return <span className="text-muted-foreground tabular-nums">{v ? fmtDateTime(v) : "Never"}</span>
      },
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => (
        <Pill tone={row.original.isActive ? "positive" : "neutral"}>{row.original.isActive ? "Active" : "Removed"}</Pill>
      ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const m = row.original
        if (!m.canManage) return null
        const showRole = m.isActive && canChangeRole
        const showRemove = m.isActive && canRemove
        const showRestore = !m.isActive && canInvite
        if (!showRole && !showRemove && !showRestore) return null
        return (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${m.name}`} />}>
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {showRestore && (
                <DropdownMenuItem disabled={busyEmail === m.email} onClick={() => reinvite(m.email, m.role, "restore")}>Restore member</DropdownMenuItem>
              )}
              {showRole && (
                <DropdownMenuItem onClick={() => { setNewRole(m.role); setRoleTarget(m) }}>Change role</DropdownMenuItem>
              )}
              {showRole && showRemove && <DropdownMenuSeparator />}
              {showRemove && (
                <DropdownMenuItem variant="destructive" onClick={() => setRemoveTarget(m)}>Remove from enterprise</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
      meta: { align: "right", className: "w-12", stickyRight: true },
    },
  ], [status, canChangeRole, canRemove, canInvite, busyEmail, reinvite])

  const inviteColumns = useMemo<ColumnDef<InviteRow, unknown>[]>(() => [
    {
      accessorKey: "email",
      header: "Invited",
      cell: ({ row }) => (
        <div className="flex min-w-0 items-center gap-3">
          <Initial name={row.original.email} />
          <PrimaryCell title={row.original.email} meta={row.original.invitedByName ? `Invited by ${row.original.invitedByName}` : undefined} />
        </div>
      ),
      meta: { className: "min-w-[240px] max-w-[360px]" },
    },
    { accessorKey: "role", header: "Role", cell: ({ row }) => <Pill>{getRoleLabel(row.original.role)}</Pill> },
    {
      accessorKey: "invitedAt",
      header: "Sent",
      cell: ({ getValue }) => <span className="text-muted-foreground tabular-nums">{fmtDateTime(getValue() as string)}</span>,
    },
    { id: "state", header: "Status", cell: () => <Pill tone="warning">Pending sign-up</Pill> },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const inv = row.original
        if (!inv.canManage || !canInvite) return null
        return (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for the invitation to ${inv.email}`} />}>
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled={busyEmail === inv.email} onClick={() => reinvite(inv.email, inv.role, "resend")}>Resend invitation</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setCancelTarget(inv)}>Cancel invitation</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
      meta: { align: "right", className: "w-12", stickyRight: true },
    },
  ], [canInvite, busyEmail, reinvite])

  const emptyState = debouncedSearch
    ? <TableEmpty title="No matches" description="Try a different name or email." />
    : status === "active"
      ? <TableEmpty title="No members yet" description="Invite your first team member." />
      : status === "pending"
        ? <TableEmpty title="No pending invitations" description="Invitations to people without an account wait here until they sign up." />
        : <TableEmpty title="No removed members" description="People removed from the enterprise are listed here." />

  const pagination = { page, pageSize: PAGE_SIZE, total }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Members"
        description={isLoading && counts.active === 0 ? "People who manage your enterprise" : `${num(counts.active)} active member${counts.active === 1 ? "" : "s"}`}
        actions={
          <PermissionGate permission={PERMISSIONS.MEMBER_INVITE}>
            <Button onClick={() => setInviteOpen(true)}>
              <UserPlus />
              Invite members
            </Button>
          </PermissionGate>
        }
      />

      <Tabs value={status} onValueChange={(v) => { setStatus(v as Status); setPage(1) }}>
        <TabsList variant="line">
          <TabsTrigger value="active">Active <span className="ml-1 text-muted-foreground tabular-nums">{num(counts.active)}</span></TabsTrigger>
          <TabsTrigger value="pending">Pending <span className="ml-1 text-muted-foreground tabular-nums">{num(counts.pending)}</span></TabsTrigger>
          <TabsTrigger value="inactive">Removed <span className="ml-1 text-muted-foreground tabular-nums">{num(counts.inactive)}</span></TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="space-y-4">
        <SearchField value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder={status === "pending" ? "Search by email…" : "Search by name or email…"} />
        {status === "pending" ? (
          <DataTable columns={inviteColumns} data={invites} isLoading={isLoading} pagination={pagination} onPaginationChange={(p) => setPage(p)} emptyState={emptyState} />
        ) : (
          <DataTable columns={memberColumns} data={members} isLoading={isLoading} pagination={pagination} onPaginationChange={(p) => setPage(p)} emptyState={emptyState} />
        )}
      </div>

      <InviteMemberDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        enterpriseId={currentEnterpriseId}
        assignableRoles={assignableRoles}
        onInvited={fetchMembers}
      />

      {/* Change role */}
      <Dialog open={!!roleTarget} onOpenChange={(open) => { if (!open && !mutating) setRoleTarget(null) }}>
        <DialogContent className="sm:max-w-[440px]">
          <form noValidate onSubmit={(e) => { e.preventDefault(); submitRole() }} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Change {roleTarget?.name}&apos;s role</DialogTitle>
              <DialogDescription>
                {viewer?.isOwner ? "As the owner you can also make someone a co-admin." : "You can assign roles below your own."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-1.5">
              <Label htmlFor="member-role">Role</Label>
              <Select items={assignableRoles.map((r) => ({ value: r, label: getRoleLabel(r) }))} value={newRole} onValueChange={(v) => setNewRole((v as string) || "")}>
                <SelectTrigger id="member-role" className="w-full data-[size=default]:h-9">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {assignableRoles.map((r) => (
                    <SelectItem key={r} value={r}>
                      <span className="font-medium">{getRoleLabel(r)}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{getRoleDescription(r)}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

      {/* Remove */}
      <Dialog open={!!removeTarget} onOpenChange={(open) => { if (!open && !mutating) setRemoveTarget(null) }}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Remove {removeTarget?.name}?</DialogTitle>
            <DialogDescription>
              They lose access to this enterprise straight away. Their account and past activity are kept.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveTarget(null)} disabled={mutating}>Keep member</Button>
            <Button variant="destructive" onClick={submitRemove} disabled={mutating}>
              {mutating && <Loader2 className="animate-spin" />}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel a pending invitation */}
      <Dialog open={!!cancelTarget} onOpenChange={(open) => { if (!open && !mutating) setCancelTarget(null) }}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Cancel the invitation to {cancelTarget?.email}?</DialogTitle>
            <DialogDescription>
              If they sign up with this address later, they won&apos;t join the enterprise. You can invite them again any time.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelTarget(null)} disabled={mutating}>Keep invitation</Button>
            <Button variant="destructive" onClick={submitCancel} disabled={mutating}>
              {mutating && <Loader2 className="animate-spin" />}
              Cancel invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
