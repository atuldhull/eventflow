import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { validateTicketQR } from "@/lib/ticket"

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { qrData } = body

    if (!qrData) {
      return NextResponse.json({ success: false, message: "QR data required" }, { status: 400 })
    }

    const result = await validateTicketQR(qrData)
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error("Ticket verification error:", error)
    return NextResponse.json({ success: false, message: "Verification failed" }, { status: 500 })
  }
}
