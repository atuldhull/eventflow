import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const payments = await prisma.payment.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, amount: true, currency: true, status: true, method: true, createdAt: true,
      registration: { select: { event: { select: { title: true, slug: true } } } },
    },
  })

  return NextResponse.json({
    success: true,
    data: payments.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      currency: p.currency,
      status: p.status,
      method: p.method,
      createdAt: p.createdAt.toISOString(),
      event: p.registration?.event || null,
    })),
  })
}
