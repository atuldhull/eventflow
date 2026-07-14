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
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { orgId } = await params
  const authResult = await authorize(
    session.user.id,
    [PERMISSIONS.EVENT_CREATE, PERMISSIONS.EVENT_EDIT],
    { organizationId: orgId }
  )
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  const slug = request.nextUrl.searchParams.get("slug")
  if (!slug) {
    return NextResponse.json({ success: false, message: "Slug parameter required" }, { status: 400 })
  }

  // Event slugs are globally unique, so availability is checked platform-wide.
  const existing = await prisma.event.findUnique({ where: { slug }, select: { id: true } })

  if (!existing) {
    return NextResponse.json({ success: true, available: true })
  }

  // Suggest alternative
  let counter = 2
  let suggestion = `${slug}-${counter}`
  while (await prisma.event.findUnique({ where: { slug: suggestion }, select: { id: true } })) {
    counter++
    suggestion = `${slug}-${counter}`
  }

  return NextResponse.json({ success: true, available: false, suggestion })
}
