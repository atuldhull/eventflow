import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"
import { deleteDraft } from "@/lib/org-communications"

/** Deletes one of this organization's email drafts. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; draftId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { orgId, draftId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.COMMUNICATION_SEND_EMAIL, { organizationId: orgId })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  const found = await deleteDraft(orgId, draftId)
  if (!found) return NextResponse.json({ success: false, message: "Draft not found" }, { status: 404 })
  return NextResponse.json({ success: true, message: "Draft deleted" })
}
