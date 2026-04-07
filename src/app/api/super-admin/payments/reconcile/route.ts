import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { withSuperAdmin } from "@/lib/guards"
import { reconcileAll } from "@/lib/reconciliation"

export const POST = withSuperAdmin(async (req) => {
  try {
    const body = await req.json()
    const dateFrom = new Date(body.dateFrom || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    const dateTo = new Date(body.dateTo || new Date().toISOString())

    const result = await reconcileAll(dateFrom, dateTo)
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error("Reconciliation error:", error)
    return NextResponse.json({ success: false, message: "Reconciliation failed" }, { status: 500 })
  }
})
