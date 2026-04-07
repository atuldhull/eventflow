import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, phone: true, city: true, bio: true, collegeName: true, companyName: true, designation: true, avatar: true },
  })

  return NextResponse.json({ success: true, data: user })
}

export async function PATCH(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const allowedFields = ["name", "phone", "city", "bio", "collegeName", "companyName", "designation"]
  const data: Record<string, string> = {}
  for (const key of allowedFields) {
    if (key in body) data[key] = body[key] || null
  }
  // Name must not be empty
  if ("name" in data && !data.name) {
    return NextResponse.json({ success: false, message: "Name is required" }, { status: 400 })
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data,
    select: { id: true, name: true, email: true, phone: true, city: true, bio: true, collegeName: true, companyName: true, designation: true },
  })

  return NextResponse.json({ success: true, data: user })
}
