import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { withSuperAdmin } from "@/lib/guards"
import prisma from "@/lib/prisma"

export const GET = withSuperAdmin(async (req) => {
  const sp = req.nextUrl.searchParams
  const page = parseInt(sp.get("page") || "1")
  const limit = parseInt(sp.get("limit") || "20")
  const status = sp.get("status") || ""

  const where: any = {}
  if (status) where.status = status

  const [messages, total, unreadCount] = await Promise.all([
    prisma.contactMessage.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
    prisma.contactMessage.count({ where }),
    prisma.contactMessage.count({ where: { status: "NEW" } }),
  ])

  return NextResponse.json({
    success: true,
    data: messages.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() })),
    unreadCount,
    pagination: { page, pageSize: limit, total, totalPages: Math.ceil(total / limit) },
  })
})

export const PATCH = withSuperAdmin(async (req) => {
  const { id, status } = await req.json()
  if (!id || !status) return NextResponse.json({ success: false, message: "ID and status required" }, { status: 400 })

  await prisma.contactMessage.update({ where: { id }, data: { status } })
  return NextResponse.json({ success: true })
})
