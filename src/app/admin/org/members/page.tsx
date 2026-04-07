"use client"

import { useState } from "react"
import { type ColumnDef } from "@tanstack/react-table"
import { Users, UserPlus, MoreHorizontal, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/PageHeader"
import { DataTable } from "@/components/tables/DataTable"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogTrigger,
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
import { Textarea } from "@/components/ui/textarea"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS, getManageableRoles, getRoleLabel, getRoleColor, getRoleDescription } from "@/lib/permissions"
import { useRBAC } from "@/hooks/useRBAC"
import { useDebounce } from "@/hooks/useDebounce"
import type { Role } from "@/lib/constants"

interface MemberRow {
  id: string
  name: string
  email: string
  role: Role
  joinedAt: string
  isActive: boolean
  eventsAssigned: number
}

const columns: ColumnDef<MemberRow, unknown>[] = [
  {
    accessorKey: "name",
    header: "Member",
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
    accessorKey: "role",
    header: "Role",
    cell: ({ row }) => (
      <Badge variant="secondary" className={getRoleColor(row.original.role)}>
        {getRoleLabel(row.original.role)}
      </Badge>
    ),
  },
  {
    accessorKey: "eventsAssigned",
    header: "Events",
    cell: ({ getValue }) => <span className="text-sm">{(getValue() as number) || "—"}</span>,
  },
  {
    accessorKey: "joinedAt",
    header: "Joined",
    cell: ({ getValue }) => <span className="text-sm text-muted-foreground">{getValue() as string}</span>,
  },
  {
    id: "actions",
    cell: () => (
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>View Profile</DropdownMenuItem>
          <DropdownMenuItem>Change Role</DropdownMenuItem>
          <DropdownMenuItem>Assign to Events</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive">Remove</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
]

export default function OrgMembersPage() {
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search)
  const [page, setPage] = useState(1)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<string>("")
  const [inviteLoading, setInviteLoading] = useState(false)
  const { role, currentOrganizationId, accessibleOrganizations } = useRBAC()
  const org = accessibleOrganizations.find((o) => o.id === currentOrganizationId)
  const manageableRoles = getManageableRoles(role)

  const handleInvite = async () => {
    if (!inviteEmail || !inviteRole || !currentOrganizationId) {
      toast.error("Please fill in all required fields")
      return
    }
    setInviteLoading(true)
    try {
      const res = await fetch("/api/members/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole, entityType: "ORGANIZATION", entityId: currentOrganizationId }),
      })
      const data = await res.json()
      if (!data.success) { toast.error(data.message); return }
      toast.success(data.message)
      setInviteOpen(false)
      setInviteEmail("")
      setInviteRole("")
    } catch { toast.error("Failed to send invitation") }
    finally { setInviteLoading(false) }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team Members"
        description={`${org?.name || "Organization"} team`}
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Organization", href: "/admin/org" }, { label: "Members" }]}
        actions={
          <PermissionGate permission={PERMISSIONS.MEMBER_INVITE}>
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger render={<Button className="gap-2" />}>
                <UserPlus className="h-4 w-4" /> Invite Member
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite Team Member</DialogTitle>
                  <DialogDescription>Send an invitation to join {org?.name || "your organization"}.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" placeholder="colleague@example.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select value={inviteRole} onValueChange={(v) => setInviteRole(v || "")}>
                      <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                      <SelectContent>
                        {manageableRoles.map((r) => (
                          <SelectItem key={r} value={r}>{getRoleLabel(r)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
                  <Button onClick={handleInvite} disabled={inviteLoading} className="gap-2">
                    {inviteLoading && <Loader2 className="h-4 w-4 animate-spin" />} Send Invitation
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </PermissionGate>
        }
      />

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="removed">Removed</TabsTrigger>
        </TabsList>
        <TabsContent value="active" className="mt-4 space-y-4">
          <Input placeholder="Search members..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
          <DataTable columns={columns} data={[]} isLoading={false} pagination={{ page, pageSize: 10, total: 0 }} onPaginationChange={(p) => setPage(p)}
            emptyState={<div className="text-center py-4"><Users className="mx-auto h-10 w-10 text-muted-foreground/30 mb-2" /><p className="font-medium">No members yet</p><p className="text-sm text-muted-foreground">Invite your first team member.</p></div>}
          />
        </TabsContent>
        <TabsContent value="pending" className="mt-4"><p className="text-center py-12 text-muted-foreground">No pending invitations</p></TabsContent>
        <TabsContent value="removed" className="mt-4"><p className="text-center py-12 text-muted-foreground">No removed members</p></TabsContent>
      </Tabs>
    </div>
  )
}
