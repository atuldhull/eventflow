"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Plus, UserPlus, Users, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
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
  getRoleColor,
} from "@/lib/permissions"
import { useDebounce } from "@/hooks/useDebounce"
import type { Role } from "@/lib/constants"

export default function MembersPage() {
  const { role, currentEnterpriseId, currentOrganizationId, can } = useRBAC()
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search)

  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<string>("")
  const [inviteMessage, setInviteMessage] = useState("")
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)

  const manageableRoles = getManageableRoles(role)
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Team Members</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your team members and their roles
          </p>
        </div>

        <PermissionGate permission={PERMISSIONS.MEMBER_INVITE}>
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger
              render={<Button className="gap-2" />}
            >
              <Plus className="h-4 w-4" />
              Invite Member
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite a Team Member</DialogTitle>
                <DialogDescription>
                  Send an invitation to join your team. They&apos;ll be added with the selected role.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-email">Email Address</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="colleague@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={inviteRole} onValueChange={(value) => setInviteRole(value || "")}>
                    <SelectTrigger>
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

                <div className="space-y-2">
                  <Label htmlFor="invite-message">Message (optional)</Label>
                  <Textarea
                    id="invite-message"
                    placeholder="Add a personal message..."
                    value={inviteMessage}
                    onChange={(e) => setInviteMessage(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>

              <DialogFooter>
                <DialogClose render={<Button variant="outline" />}>
                  Cancel
                </DialogClose>
                <Button onClick={handleInvite} disabled={inviteLoading} className="gap-2">
                  {inviteLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UserPlus className="h-4 w-4" />
                  )}
                  Send Invitation
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </PermissionGate>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <Input
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {/* Members list placeholder */}
      <div className="rounded-lg border">
        <div className="p-8 text-center text-muted-foreground">
          <Users className="mx-auto h-12 w-12 mb-4 opacity-30" />
          <p className="text-lg font-medium">Member Management</p>
          <p className="text-sm mt-1">
            {entityId
              ? "Members will appear here once the database is connected."
              : "Select an enterprise or organization to manage members."}
          </p>
        </div>
      </div>
    </div>
  )
}
