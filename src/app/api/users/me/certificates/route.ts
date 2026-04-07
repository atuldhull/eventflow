import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getUserCertificates } from "@/lib/certificate"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const certificates = await getUserCertificates(session.user.id)

  return NextResponse.json({
    success: true,
    data: certificates.map((c) => ({
      ...c,
      issuedDate: c.issuedDate.toISOString(),
      downloadedAt: c.downloadedAt?.toISOString() || null,
      event: {
        ...c.event,
        startDate: c.event.startDate.toISOString(),
      },
    })),
  })
}
