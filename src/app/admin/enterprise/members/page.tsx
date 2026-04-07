"use client"

import { useState } from "react"
import { type ColumnDef } from "@tanstack/react-table"
import { Users, Plus, MoreHorizontal, UserPlus, Loader2 } from "lucide-react"
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
    accessorKey: "joinedAt",
    header: "Joined",
    cell: ({ getValue }) => <span className="text-sm text-muted-foreground">{getValue() as string}</span>,
  },
  {
    accessorKey: "isActive",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant={row.original.isActive ? "default" : "secondary"}>
        {row.original.isActive ? "Active" : "Inactive"}
      </Badge>
    ),
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
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive">Remove</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
]

export default function EnterpriseMembersPage() {
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search)
  const [page, setPage] = useState(1)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<string>("")
  const [inviteMessage, setInviteMessage] = useState("")
  const [inviteLoading, setInviteLoading] = useState(false)
  const { role, currentEnterpriseId } = useRBAC()
  const manageableRoles = getManageableRoles(role)

  const handleInvite = async () => {
    if (!inviteEmail || !inviteRole || !currentEnterpriseId) {
      toast.error("Please fill in all required fields")
      return
    }
    setInviteLoading(true)
    try {
      const res = await fetch("/api/members/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
          entityType: "ENTERPRISE",
          entityId: currentEnterpriseId,
          message: inviteMessage || undefined,
        }),
      })
      const data = await res.json()
      if (!data.success) {
        toast.error(data.message)
        return
      }
      toast.success(data.message)
      setInviteOpen(false)
      setInviteEmail("")
      setInviteRole("")
      setInviteMessage("")
    } catch {
      toast.error("Failed to send invitation")
    } finally {
      setInviteLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team Members"
        description="Manage your enterprise team"
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Enterprise", href: "/admin/enterprise" },
          { label: "Members" },
        ]}
        actions={
          <PermissionGate permission={PERMISSIONS.MEMBER_INVITE}>
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger render={<Button className="gap-2" />}>
                <UserPlus className="h-4 w-4" />
                Invite Member
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite Team Member</DialogTitle>
                  <DialogDescription>Send an invitation to join your enterprise.</DialogDescription>
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
                          <SelectItem key={r} value={r}>
                            <span className="font-medium">{getRoleLabel(r)}</span>
                            <span className="text-xs text-muted-foreground ml-2">{getRoleDescription(r)}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Message (optional)</Label>
                    <Textarea placeholder="Add a message..." value={inviteMessage} onChange={(e) => setInviteMessage(e.target.value)} rows={2} />
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
                  <Button onClick={handleInvite} disabled={inviteLoading} className="gap-2">
                    {inviteLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                    Send Invitation
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </PermissionGate>
        }
      />

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Active Members</TabsTrigger>
          <TabsTrigger value="pending">Pending Invitations</TabsTrigger>
          <TabsTrigger value="inactive">Inactive</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4 space-y-4">
          <Input placeholder="Search members..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
          <DataTable
            columns={columns}
            data={[]}
            isLoading={false}
            pagination={{ page, pageSize: 10, total: 0 }}
            onPaginationChange={(p) => setPage(p)}
            emptyState={
              <div className="text-center py-4">
                <Users className="mx-auto h-10 w-10 text-muted-foreground/30 mb-2" />
                <p className="font-medium">No members yet</p>
                <p className="text-sm text-muted-foreground">Invite your first team member.</p>
              </div>
            }
          />
        </TabsContent>

        <TabsContent value="pending" className="mt-4">
          <div className="text-center py-12 text-muted-foreground">
            <p className="font-medium">No pending invitations</p>
          </div>
        </TabsContent>

        <TabsContent value="inactive" className="mt-4">
          <div className="text-center py-12 text-muted-foreground">
            <p className="font-medium">No inactive members</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
