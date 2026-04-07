import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const slug = request.nextUrl.searchParams.get("slug")
  if (!slug) {
    return NextResponse.json({ success: false, message: "Slug parameter required" }, { status: 400 })
  }

  const existing = await prisma.event.findUnique({ where: { slug } })

  if (!existing) {
    return NextResponse.json({ success: true, available: true })
  }

  // Suggest alternative
  let counter = 2
  let suggestion = `${slug}-${counter}`
  while (await prisma.event.findUnique({ where: { slug: suggestion } })) {
    counter++
    suggestion = `${slug}-${counter}`
  }

  return NextResponse.json({ success: true, available: false, suggestion })
}
