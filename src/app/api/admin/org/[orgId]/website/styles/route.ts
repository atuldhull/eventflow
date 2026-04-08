import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"

// PATCH — Quick-save just styles
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })

  const { orgId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_EDIT, { organizationId: orgId })
  if (!authResult.authorized) return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })

  const existing = await prisma.siteConfig.findUnique({ where: { organizationId: orgId } })
  if (!existing) return NextResponse.json({ success: false, message: "No website exists" }, { status: 404 })

  const body = await req.json()

  const updated = await prisma.siteConfig.update({
    where: { organizationId: orgId },
    data: { styles: body.styles as any, lastEditedAt: new Date(), lastEditedBy: session.user.id },
  })

  return NextResponse.json({ success: true, styles: updated.styles })
}
