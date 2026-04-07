import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"
import { z } from "zod/v4"

const createCouponSchema = z.object({
  code: z.string().min(3).max(30).regex(/^[A-Z0-9_-]+$/, "Uppercase letters, numbers, hyphens, underscores only"),
  discountType: z.enum(["PERCENTAGE", "FLAT"]),
  discountValue: z.number().positive(),
  maxUses: z.number().int().positive().optional(),
  maxUsesPerUser: z.number().int().positive().default(1),
  minOrderAmount: z.number().min(0).default(0),
  validFrom: z.coerce.date(),
  validUntil: z.coerce.date(),
  eventId: z.string().optional(),
  isActive: z.boolean().default(true),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { orgId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.COUPON_VIEW, { organizationId: orgId })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  const coupons = await prisma.coupon.findMany({
    where: { OR: [{ event: { organizationId: orgId } }, { enterpriseId: null, eventId: null }] },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, code: true, discountType: true, discountValue: true,
      maxUses: true, currentUses: true, maxUsesPerUser: true,
      validFrom: true, validUntil: true, isActive: true, createdAt: true,
      event: { select: { title: true } },
    },
  })

  return NextResponse.json({
    success: true,
    data: coupons.map((c) => ({
      ...c,
      discountValue: Number(c.discountValue),
      validFrom: c.validFrom?.toISOString() || null,
      validUntil: c.validUntil?.toISOString() || null,
      createdAt: c.createdAt.toISOString(),
    })),
  })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { orgId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.COUPON_CREATE, { organizationId: orgId })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  const body = await request.json()
  const parsed = createCouponSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  // Check duplicate code within org
  // Code is unique globally in schema
  const existing = await prisma.coupon.findUnique({
    where: { code: parsed.data.code },
  })
  if (existing) {
    return NextResponse.json({ success: false, message: "Coupon code already exists" }, { status: 409 })
  }

  // Validate percentage <= 100
  if (parsed.data.discountType === "PERCENTAGE" && parsed.data.discountValue > 100) {
    return NextResponse.json({ success: false, message: "Percentage discount cannot exceed 100%" }, { status: 400 })
  }

  // Link coupon to an event within this org if eventId provided, otherwise global
  const data: any = { ...parsed.data }
  if (data.eventId) {
    // Verify event belongs to this org
    const event = await prisma.event.findFirst({ where: { id: data.eventId, organizationId: orgId } })
    if (!event) return NextResponse.json({ success: false, message: "Event not found in this organization" }, { status: 404 })
  }
  const coupon = await prisma.coupon.create({ data })

  return NextResponse.json({ success: true, data: coupon }, { status: 201 })
}
