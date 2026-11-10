import { NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { z } from "zod/v4"
import { withSuperAdmin } from "@/lib/guards"
import prisma from "@/lib/prisma"
import { createAuditLog, getClientInfo } from "@/lib/audit"
import { parsePaging } from "@/lib/enterprise-admin"

/** The states a contact message moves through (what /super-admin/messages shows). */
const MESSAGE_STATUSES = ["NEW", "READ", "REPLIED", "CLOSED"] as const

export const GET = withSuperAdmin(async (req) => {
  const sp = req.nextUrl.searchParams
  const { page, limit, skip } = parsePaging(sp, 20)
  const status = MESSAGE_STATUSES.find((s) => s === sp.get("status"))

  const where: Prisma.ContactMessageWhereInput = status ? { status } : {}

  const [messages, total, unreadCount] = await Promise.all([
    prisma.contactMessage.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit }),
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

const updateSchema = z.object({
  id: z.string().trim().min(1, "Message id is required"),
  status: z.enum(MESSAGE_STATUSES, `Status must be one of ${MESSAGE_STATUSES.join(", ")}`),
})

/** Change a message's status: only the known states, and a 404 (not a 500) for an unknown id. */
export const PATCH = withSuperAdmin(async (req, { user }) => {
  const parsed = updateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message ?? "Validation failed" }, { status: 400 })
  }
  const { id, status } = parsed.data

  const current = await prisma.contactMessage.findUnique({ where: { id }, select: { status: true, subject: true } })
  if (!current) {
    return NextResponse.json({ success: false, message: "Message not found" }, { status: 404 })
  }

  const updated = await prisma.contactMessage.update({
    where: { id },
    data: {
      status,
      ...(status === "REPLIED" ? { repliedAt: new Date(), repliedBy: user.id } : {}),
    },
    select: { id: true, status: true },
  })

  const { ipAddress, userAgent } = getClientInfo(req)
  await createAuditLog({
    userId: user.id,
    action: "UPDATE",
    entityType: "CONTACT_MESSAGE",
    entityId: id,
    description: `Marked contact message "${current.subject}" as ${status}`,
    oldValues: { status: current.status },
    newValues: { status },
    ipAddress,
    userAgent,
  })

  return NextResponse.json({ success: true, message: `Marked as ${status.toLowerCase()}`, data: updated })
})
