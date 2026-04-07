import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  try {
    const { code, eventId, ticketPrice, quantity } = await request.json()

    if (!code || !eventId) {
      return NextResponse.json({ success: false, message: "Code and event ID required" }, { status: 400 })
    }

    const now = new Date()
    const coupon = await prisma.coupon.findFirst({
      where: {
        code: code.toUpperCase().trim(),
        isActive: true,
        validFrom: { lte: now },
        validUntil: { gte: now },
        OR: [{ eventId }, { eventId: null }],
      },
    })

    if (!coupon) {
      return NextResponse.json({ success: false, message: "Invalid or expired coupon code" }, { status: 400 })
    }

    if (coupon.maxUses && coupon.currentUses >= coupon.maxUses) {
      return NextResponse.json({ success: false, message: "This coupon has been fully redeemed" }, { status: 400 })
    }

    const price = (ticketPrice || 0) * (quantity || 1)
    if (coupon.minOrderAmount && price < Number(coupon.minOrderAmount)) {
      return NextResponse.json({ success: false, message: `Minimum order amount is ₹${coupon.minOrderAmount}` }, { status: 400 })
    }

    const discount = coupon.discountType === "PERCENTAGE"
      ? (price * Number(coupon.discountValue)) / 100
      : Math.min(Number(coupon.discountValue), price)

    return NextResponse.json({
      success: true,
      data: {
        valid: true,
        coupon: { code: coupon.code, discountType: coupon.discountType, discountValue: Number(coupon.discountValue) },
        discount: Math.round(discount * 100) / 100,
        finalPrice: Math.max(0, Math.round((price - discount) * 100) / 100),
      },
    })
  } catch (error) {
    console.error("Coupon validation error:", error)
    return NextResponse.json({ success: false, message: "Failed to validate coupon" }, { status: 500 })
  }
}
