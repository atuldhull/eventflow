import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  // Subscription invoices would come from Razorpay/Stripe API
  // For now return empty
  return NextResponse.json({
    success: true,
    data: [],
    pagination: { page: 1, total: 0, totalPages: 0 },
  })
}
