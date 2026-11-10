import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getUserCertificates } from "@/lib/certificate"
import { certificateVerificationState } from "@/lib/certificate-verification"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const certificates = await getUserCertificates(session.user.id)

  return NextResponse.json({
    success: true,
    data: certificates.map(({ metadata, ...c }) => ({
      ...c,
      // valid | not_issued | revoked, by the same rule as the public verification page
      state: certificateVerificationState(c.status, metadata),
      issuedDate: c.issuedDate.toISOString(),
      downloadedAt: c.downloadedAt?.toISOString() || null,
      event: {
        ...c.event,
        startDate: c.event.startDate.toISOString(),
      },
    })),
  })
}
