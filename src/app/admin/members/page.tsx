"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Plus, Search, UserPlus, Users, Loader2 } from "lucide-react"

import { PageHeader } from "@/components/shared/PageHeader"
import { EmptyState } from "@/components/shared/EmptyState"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { PermissionGate } from "@/components/auth/PermissionGate"
import { useRBAC } from "@/hooks/useRBAC"
import {
  PERMISSIONS,
  getManageableRoles,
  getRoleLabel,
  getRoleDescription,
} from "@/lib/permissions"

export default function MembersPage() {
  const { isSuperAdmin, enterpriseRole, organizationRole, currentEnterpriseId, currentOrganizationId } = useRBAC()
  const [search, setSearch] = useState("")

  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<string>("")
  const [inviteMessage, setInviteMessage] = useState("")
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)

  // the role held in the workspace being managed, never the global role
  const contextRole = isSuperAdmin ? "SUPER_ADMIN" : (currentEnterpriseId ? enterpriseRole : organizationRole)
  const manageableRoles = contextRole ? getManageableRoles(contextRole) : []
  const entityType = currentEnterpriseId ? "ENTERPRISE" : "ORGANIZATION"
  const entityId = currentEnterpriseId || currentOrganizationId

  const handleInvite = async () => {
    if (!inviteEmail || !inviteRole || !entityId) {
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
          entityType,
          entityId,
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
        title="Team members"
        description="Manage your team members and their roles"
        actions={
          <PermissionGate permission={PERMISSIONS.MEMBER_INVITE}>
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger render={<Button />}>
                <Plus /> Invite member
              </DialogTrigger>
              <DialogContent className="sm:max-w-[460px]">
                <DialogHeader>
                  <DialogTitle>Invite a team member</DialogTitle>
                  <DialogDescription>
                    Send an invitation to join your team. They&apos;ll be added with the selected role.
                  </DialogDescription>
                </DialogHeader>

                <form
                  id="invite-member-form"
                  noValidate
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault()
                    void handleInvite()
                  }}
                >
                  <div className="space-y-1.5">
                    <Label htmlFor="invite-email">Email address</Label>
                    <Input
                      id="invite-email"
                      type="email"
                      placeholder="colleague@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="invite-role">Role</Label>
                    <Select
                      items={manageableRoles.map((r) => ({ value: r, label: getRoleLabel(r) }))}
                      value={inviteRole}
                      onValueChange={(value) => setInviteRole(value || "")}
                    >
                      <SelectTrigger id="invite-role" className="w-full">
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                      <SelectContent>
                        {manageableRoles.map((r) => (
                          <SelectItem key={r} value={r}>
                            <div>
                              <span className="font-medium">{getRoleLabel(r)}</span>
                              <p className="text-xs text-muted-foreground">{getRoleDescription(r)}</p>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="invite-message">Message (optional)</Label>
                    <Textarea
                      id="invite-message"
                      placeholder="Add a personal message..."
                      value={inviteMessage}
                      onChange={(e) => setInviteMessage(e.target.value)}
                      rows={3}
                    />
                  </div>
                </form>

                <DialogFooter>
                  <DialogClose render={<Button variant="outline" />}>
                    Cancel
                  </DialogClose>
                  <Button type="submit" form="invite-member-form" disabled={inviteLoading}>
                    {inviteLoading ? <Loader2 className="animate-spin" /> : <UserPlus />}
                    Send invitation
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </PermissionGate>
        }
      />

      {/* Search */}
      <div className="relative sm:max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" aria-hidden />
        <Input
          type="search"
          aria-label="Search members"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Members list placeholder */}
      <EmptyState
        icon={Users}
        title="Member Management"
        description={
          entityId
            ? "Members will appear here once the database is connected."
            : "Select an enterprise or organization to manage members."
        }
      />
    </div>
  )
}
