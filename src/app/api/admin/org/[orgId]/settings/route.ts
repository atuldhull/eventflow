import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  const { orgId } = await params

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true, category: true, description: true, email: true, phone: true, website: true, socialLinks: true, settings: true },
  })

  return NextResponse.json({ success: true, data: org })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  const { orgId } = await params

  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_MANAGE_SETTINGS, { organizationId: orgId })
  if (!authResult.authorized) return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })

  const body = await request.json()
  const allowedFields = ["name", "category", "description", "email", "phone", "website", "socialLinks", "settings"]
  const data: Record<string, any> = {}
  for (const key of allowedFields) { if (key in body) data[key] = body[key] }

  await prisma.organization.update({ where: { id: orgId }, data })

  return NextResponse.json({ success: true, message: "Settings saved" })
}
