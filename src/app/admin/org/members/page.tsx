"use client"

import { useCallback, useEffect, useState } from "react"
import { type ColumnDef } from "@tanstack/react-table"
import { Users, UserPlus, MoreHorizontal, Loader2, MailOpen, UserMinus } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/PageHeader"
import { EmptyState } from "@/components/shared/EmptyState"
import { DataTable } from "@/components/tables/DataTable"
import { DataTableSearch, DataTableToolbar } from "@/components/tables/DataTableToolbar"
import { Button } from "@/components/ui/button"
import { Pill } from "@/components/ui/pill"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { InviteMembersDialog } from "@/components/members/invite-members-dialog"
import { PERMISSIONS, canManageRole, getManageableRoles, getRoleLabel, getRoleDescription } from "@/lib/permissions"
import { useRBAC } from "@/hooks/useRBAC"
import { useDebounce } from "@/hooks/useDebounce"
import type { Role } from "@/lib/constants"

type TabStatus = "active" | "pending" | "removed"

interface MemberRow {
  id: string
  userId: string
  name: string
  email: string
  role: Role
  joinedAt: string
  updatedAt: string
  lastLoginAt: string | null
  isActive: boolean
  isSelf: boolean
  eventsAssigned: number
}

interface InviteRow {
  email: string
  role: Role
  invitedAt: string
  invitedByName: string | null
}

type Counts = Record<TabStatus, number>

const PAGE_SIZE = 10

const fmtDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"

function Person({ name, email, isSelf }: { name: string; email: string; isSelf?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
        {name?.trim()?.[0]?.toUpperCase() || email?.[0]?.toUpperCase() || "?"}
      </span>
      <div className="min-w-0">
        <p className="flex items-center gap-2 truncate font-medium">
          <span className="truncate">{name || email}</span>
          {isSelf && <Pill tone="brand">You</Pill>}
        </p>
        <p className="truncate text-[13px] text-muted-foreground">{email}</p>
      </div>
    </div>
  )
}

function RowMenu({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={label} className="text-muted-foreground" />}>
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">{children}</DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Role picker limited to the roles the signed-in person may grant here. */
function RoleSelect({ id, value, onChange, roles }: { id: string; value: string; onChange: (v: string) => void; roles: Role[] }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>Role</Label>
      <Select value={value} onValueChange={(v) => onChange(v || "")}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder="Select role">{(v: string) => (v ? getRoleLabel(v as Role) : "Select role")}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {roles.map((r) => (
            <SelectItem key={r} value={r}>{getRoleLabel(r)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {value && <p className="text-[13px] text-muted-foreground">{getRoleDescription(value as Role)}</p>}
    </div>
  )
}

async function send(url: string, method: string, body: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  const json = await res.json().catch(() => ({}))
  return { ok: Boolean(json.success), message: (json.message as string) || "Something went wrong" }
}

type PendingAction =
  | { kind: "role"; member: MemberRow }
  | { kind: "remove"; member: MemberRow }
  | { kind: "restore"; member: MemberRow }
  | { kind: "cancel"; invite: InviteRow }

function TeamTab({
  orgId,
  status,
  actorRole,
  reloadKey,
  onCounts,
  onChanged,
}: {
  orgId: string
  status: TabStatus
  actorRole: Role
  reloadKey: number
  onCounts: (c: Counts) => void
  onChanged: () => void
}) {
  const { can } = useRBAC()
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search.trim())
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<(MemberRow | InviteRow)[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [action, setAction] = useState<PendingAction | null>(null)
  const [newRole, setNewRole] = useState("")
  const [busy, setBusy] = useState(false)
  const [resending, setResending] = useState<string | null>(null)

  // a new search starts again from the first page
  const [searchedFor, setSearchedFor] = useState(debouncedSearch)
  if (searchedFor !== debouncedSearch) {
    setSearchedFor(debouncedSearch)
    setPage(1)
  }

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ status, page: String(page), limit: String(PAGE_SIZE) })
      if (debouncedSearch) params.set("search", debouncedSearch)
      const res = await fetch(`/api/admin/org/${orgId}/members?${params}`)
      const json = await res.json()
      if (json.success) {
        setRows(json.data)
        setTotal(json.pagination.total)
        if (json.counts) onCounts(json.counts)
      } else {
        toast.error(json.message || "Failed to load the team")
      }
    } catch {
      toast.error("Failed to load the team")
    } finally {
      setIsLoading(false)
    }
  }, [orgId, status, page, debouncedSearch, onCounts])

  useEffect(() => { load() }, [load, reloadKey])

  const manageable = getManageableRoles(actorRole)
  const canChangeRole = can(PERMISSIONS.MEMBER_CHANGE_ROLE)
  const canRemove = can(PERMISSIONS.MEMBER_REMOVE)
  const canInvite = can(PERMISSIONS.MEMBER_INVITE)
  // the server decides; this only hides actions that would be refused
  const outranks = (role: Role) => canManageRole(actorRole, role)

  const entity = { entityType: "ORGANIZATION", entityId: orgId }

  const resend = async (invite: InviteRow) => {
    setResending(invite.email)
    const r = await send("/api/members/invite", "POST", { email: invite.email, role: invite.role, ...entity })
    setResending(null)
    if (!r.ok) { toast.error(r.message); return }
    toast.success(r.message === "Member added successfully." ? `${invite.email} has an account now and was added to the team` : "Invitation sent again")
    onChanged()
  }

  const confirm = async () => {
    if (!action) return
    setBusy(true)
    let r: { ok: boolean; message: string }
    if (action.kind === "role") {
      r = await send(`/api/members/${action.member.id}/role`, "PATCH", { role: newRole, ...entity })
    } else if (action.kind === "remove") {
      r = await send(`/api/members/${action.member.id}/remove`, "DELETE", entity)
    } else if (action.kind === "restore") {
      r = await send("/api/members/invite", "POST", { email: action.member.email, role: action.member.role, ...entity })
    } else {
      r = await send(`/api/admin/org/${orgId}/members/invites`, "DELETE", { email: action.invite.email })
    }
    setBusy(false)
    if (!r.ok) { toast.error(r.message); return }
    toast.success(
      action.kind === "role" ? "Role updated"
        : action.kind === "remove" ? "Member removed"
        : action.kind === "restore" ? "Member restored"
        : "Invitation cancelled"
    )
    setAction(null)
    onChanged()
  }

  const memberColumns: ColumnDef<MemberRow, unknown>[] = [
    {
      accessorKey: "name",
      header: "Member",
      cell: ({ row }) => <Person name={row.original.name} email={row.original.email} isSelf={row.original.isSelf} />,
      meta: { className: "min-w-[220px]" },
    },
    { accessorKey: "role", header: "Role", cell: ({ row }) => <Pill>{getRoleLabel(row.original.role)}</Pill> },
    ...(status === "active"
      ? ([
          {
            accessorKey: "eventsAssigned",
            header: "Events",
            meta: { align: "right" },
            cell: ({ getValue }) => <span>{(getValue() as number) || "—"}</span>,
          },
          {
            accessorKey: "joinedAt",
            header: "Joined",
            cell: ({ getValue }) => <span className="text-muted-foreground">{fmtDate(getValue() as string)}</span>,
          },
          {
            accessorKey: "lastLoginAt",
            header: "Last sign-in",
            cell: ({ getValue }) => <span className="text-muted-foreground">{getValue() ? fmtDate(getValue() as string) : "Never"}</span>,
          },
        ] satisfies ColumnDef<MemberRow, unknown>[])
      : ([
          {
            accessorKey: "updatedAt",
            header: "Removed",
            cell: ({ getValue }) => <span className="text-muted-foreground">{fmtDate(getValue() as string)}</span>,
          },
        ] satisfies ColumnDef<MemberRow, unknown>[])),
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      meta: { align: "right", className: "w-12", stickyRight: true },
      cell: ({ row }) => {
        const m = row.original
        if (m.isSelf || !outranks(m.role)) return null
        if (status === "removed") {
          if (!canInvite || !manageable.includes(m.role)) return null
          return (
            <RowMenu label={`Actions for ${m.name}`}>
              <DropdownMenuItem onClick={() => setAction({ kind: "restore", member: m })}>Restore to the team</DropdownMenuItem>
            </RowMenu>
          )
        }
        if (!canChangeRole && !canRemove) return null
        return (
          <RowMenu label={`Actions for ${m.name}`}>
            {canChangeRole && (
              <DropdownMenuItem onClick={() => { setNewRole(m.role); setAction({ kind: "role", member: m }) }}>Change role</DropdownMenuItem>
            )}
            {canChangeRole && canRemove && <DropdownMenuSeparator />}
            {canRemove && (
              <DropdownMenuItem variant="destructive" onClick={() => setAction({ kind: "remove", member: m })}>Remove from team</DropdownMenuItem>
            )}
          </RowMenu>
        )
      },
    },
  ]

  const inviteColumns: ColumnDef<InviteRow, unknown>[] = [
    { accessorKey: "email", header: "Email", cell: ({ row }) => <Person name="" email={row.original.email} />, meta: { className: "min-w-[220px]" } },
    { accessorKey: "role", header: "Role", cell: ({ row }) => <Pill>{getRoleLabel(row.original.role)}</Pill> },
    {
      accessorKey: "invitedAt",
      header: "Invited",
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {fmtDate(row.original.invitedAt)}
          {row.original.invitedByName && <span className="max-sm:hidden"> by {row.original.invitedByName}</span>}
        </span>
      ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      meta: { align: "right", className: "w-12", stickyRight: true },
      cell: ({ row }) => {
        const inv = row.original
        if (!canInvite || !outranks(inv.role)) return null
        return (
          <RowMenu label={`Actions for ${inv.email}`}>
            <DropdownMenuItem disabled={resending === inv.email} onClick={() => resend(inv)}>Resend invitation</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => setAction({ kind: "cancel", invite: inv })}>Cancel invitation</DropdownMenuItem>
          </RowMenu>
        )
      },
    },
  ]

  const empty =
    debouncedSearch ? (
      <EmptyState icon={Users} title="No one matches" description="Try another name or email." className="border-0 py-6" />
    ) : status === "active" ? (
      <EmptyState icon={Users} title="No members yet" description="Invite your first team member." className="border-0 py-6" />
    ) : status === "pending" ? (
      <EmptyState icon={MailOpen} title="No pending invitations" description="Invitations to people without an account wait here until they join." className="border-0 py-6" />
    ) : (
      <EmptyState icon={UserMinus} title="No removed members" className="border-0 py-6" />
    )

  const tableProps = {
    isLoading,
    pagination: { page, pageSize: PAGE_SIZE, total },
    onPaginationChange: (p: number) => setPage(p),
    emptyState: empty,
  }

  const dialogTitle =
    action?.kind === "role" ? `Change ${action.member.name}'s role`
      : action?.kind === "remove" ? `Remove ${action.member.name}?`
      : action?.kind === "restore" ? `Restore ${action.member.name}?`
      : action?.kind === "cancel" ? "Cancel this invitation?"
      : ""

  return (
    <div className="space-y-3">
      <DataTableToolbar>
        <DataTableSearch
          placeholder={status === "pending" ? "Search by email" : "Search by name or email"}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </DataTableToolbar>
      {status === "pending" ? (
        <DataTable columns={inviteColumns} data={rows as InviteRow[]} {...tableProps} />
      ) : (
        <DataTable columns={memberColumns} data={rows as MemberRow[]} {...tableProps} />
      )}

      <Dialog open={action !== null} onOpenChange={(open) => { if (!open && !busy) setAction(null) }}>
        <DialogContent>
          <form onSubmit={(e) => { e.preventDefault(); confirm() }} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>{dialogTitle}</DialogTitle>
              <DialogDescription>
                {action?.kind === "role" && "They keep their place on the team; only what they can do changes."}
                {action?.kind === "remove" && `${action.member.email} loses access to this organization. You can restore them later from Removed.`}
                {action?.kind === "restore" && `${action.member.email} rejoins as ${getRoleLabel(action.member.role)}.`}
                {action?.kind === "cancel" && `${action.invite.email} won't be able to join from the invitation they received.`}
              </DialogDescription>
            </DialogHeader>
            {action?.kind === "role" && (
              <RoleSelect id="change-role" value={newRole} onChange={setNewRole} roles={manageable} />
            )}
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" disabled={busy} />}>Cancel</DialogClose>
              <Button
                type="submit"
                variant={action?.kind === "remove" || action?.kind === "cancel" ? "destructive" : "default"}
                disabled={busy || (action?.kind === "role" && (!newRole || newRole === action.member.role))}
              >
                {busy && <Loader2 className="animate-spin" />}
                {action?.kind === "role" ? "Save role"
                  : action?.kind === "remove" ? "Remove"
                  : action?.kind === "restore" ? "Restore"
                  : "Cancel invitation"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function OrgMembersPage() {
  const [tab, setTab] = useState<TabStatus>("active")
  const [counts, setCounts] = useState<Counts | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [inviteOpen, setInviteOpen] = useState(false)
  const { organizationRole, isSuperAdmin, currentOrganizationId, accessibleOrganizations } = useRBAC()
  const org = accessibleOrganizations.find((o) => o.id === currentOrganizationId)
  // rank comparisons use the role held in THIS organization (directly or through its
  // enterprise), as the server does, never the global role
  const actorRole: Role = isSuperAdmin ? "SUPER_ADMIN" : (organizationRole ?? (org?.role as Role | undefined) ?? "USER")
  const manageableRoles = getManageableRoles(actorRole)

  const reload = useCallback(() => setReloadKey((k) => k + 1), [])

  const countLabel = (s: TabStatus) =>
    counts ? <span className="text-muted-foreground tabular-nums">{counts[s].toLocaleString("en-IN")}</span> : null

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team"
        description={`People who run ${org?.name || "your organization"}`}
        actions={
          <PermissionGate permission={PERMISSIONS.MEMBER_INVITE}>
            <Button onClick={() => setInviteOpen(true)}>
              <UserPlus /> Invite member
            </Button>
            {/* one address or a pasted list / .csv; the field keeps its #invite-email id */}
            <InviteMembersDialog
              open={inviteOpen}
              onOpenChange={setInviteOpen}
              entityType="ORGANIZATION"
              entityId={currentOrganizationId}
              assignableRoles={manageableRoles}
              onInvited={reload}
              inputId="invite-email"
              description={`People with an EventFlow account join ${org?.name || "your organization"} straight away; anyone else gets an email invitation.`}
            />
          </PermissionGate>
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabStatus)} className="gap-5">
        <TabsList variant="line">
          <TabsTrigger value="active">Active {countLabel("active")}</TabsTrigger>
          <TabsTrigger value="pending">Pending {countLabel("pending")}</TabsTrigger>
          <TabsTrigger value="removed">Removed {countLabel("removed")}</TabsTrigger>
        </TabsList>
        {(["active", "pending", "removed"] as const).map((s) => (
          <TabsContent key={s} value={s}>
            {currentOrganizationId && tab === s && (
              <TeamTab
                orgId={currentOrganizationId}
                status={s}
                actorRole={actorRole}
                reloadKey={reloadKey}
                onCounts={setCounts}
                onChanged={reload}
              />
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
