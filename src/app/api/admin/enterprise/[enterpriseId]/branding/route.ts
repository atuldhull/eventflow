import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  const { enterpriseId } = await params

  const enterprise = await prisma.enterprise.findUnique({
    where: { id: enterpriseId },
    select: { logo: true, banner: true, primaryColor: true, secondaryColor: true, customDomain: true, subdomain: true },
  })

  return NextResponse.json({ success: true, data: enterprise })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })

  const { enterpriseId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.ENTERPRISE_EDIT, { enterpriseId })
  if (!authResult.authorized) return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })

  const body = await request.json()
  const allowedFields = ["logo", "banner", "primaryColor", "secondaryColor", "customDomain"]
  const data: Record<string, any> = {}
  for (const key of allowedFields) {
    if (key in body) data[key] = body[key]
  }

  const enterprise = await prisma.enterprise.update({ where: { id: enterpriseId }, data })

  return NextResponse.json({ success: true, data: enterprise })
}
