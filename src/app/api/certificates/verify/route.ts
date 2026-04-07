import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { verifyCertificate } from "@/lib/certificate"

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code")
  if (!code) {
    return NextResponse.json({ success: false, message: "Verification code required" }, { status: 400 })
  }

  const result = await verifyCertificate(code)
  return NextResponse.json({ success: true, data: result })
}
