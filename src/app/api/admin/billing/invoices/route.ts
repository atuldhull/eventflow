import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const entityType = request.nextUrl.searchParams.get("entityType") as "enterprise" | "org" || "org"
  const entityId = request.nextUrl.searchParams.get("entityId")

  if (!entityId) {
    return NextResponse.json({ success: false, message: "Entity ID required" }, { status: 400 })
  }

  const access = await authorize(
    session.user.id,
    PERMISSIONS.PAYMENT_VIEW,
    entityType === "enterprise" ? { enterpriseId: entityId } : { organizationId: entityId }
  )
  if (!access.authorized) {
    return NextResponse.json({ success: false, message: access.message }, { status: 403 })
  }

  // Subscription invoices are issued by the payment gateway (Razorpay) and are not
  // mirrored locally yet, so there is nothing to list.
  return NextResponse.json({
    success: true,
    data: [],
    pagination: { page: 1, total: 0, totalPages: 0 },
  })
}
