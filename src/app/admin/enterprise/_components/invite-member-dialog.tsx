"use client"

import { InviteMembersDialog } from "@/components/members/invite-members-dialog"
import type { Role } from "@/lib/constants"

export { parseEmailList } from "@/lib/email-list"

/**
 * Invite one or several people to the enterprise (paste a list or upload a .csv): the
 * shared invite dialog, aimed at this enterprise. See InviteMembersDialog.
 */
export function InviteMemberDialog({
  open,
  onOpenChange,
  enterpriseId,
  assignableRoles,
  onInvited,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  enterpriseId: string | null
  /** roles the inviter may hand out IN this enterprise (from the members API / useRBAC) */
  assignableRoles: Role[]
  onInvited?: () => void
}) {
  return (
    <InviteMembersDialog
      open={open}
      onOpenChange={onOpenChange}
      entityType="ENTERPRISE"
      entityId={enterpriseId}
      assignableRoles={assignableRoles}
      onInvited={onInvited}
    />
  )
}
