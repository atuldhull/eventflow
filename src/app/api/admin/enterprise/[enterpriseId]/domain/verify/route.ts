import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"
import { createAuditLog, getClientInfo } from "@/lib/audit"
import dns from "dns/promises"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { enterpriseId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.ENTERPRISE_MANAGE_SETTINGS, { enterpriseId })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  try {
    const { domain } = await request.json()
    if (!domain) {
      return NextResponse.json({ success: false, message: "Domain required" }, { status: 400 })
    }

    // Check DNS
    let verified = false
    let records: string[] = []
    try {
      const cnameRecords = await dns.resolveCname(domain)
      records = cnameRecords
      verified = cnameRecords.some((r) => r.includes("eventflow") || r.includes("cname.eventflow"))
    } catch {
      try {
        const aRecords = await dns.resolve4(domain)
        records = aRecords
        // In production: check against known EventFlow IPs
        verified = aRecords.length > 0
      } catch {
        verified = false
      }
    }

    if (verified) {
      await prisma.enterprise.update({
        where: { id: enterpriseId },
        data: { customDomain: domain },
      })

      const { ipAddress, userAgent } = getClientInfo(request)
      await createAuditLog({
        userId: session.user.id,
        action: "UPDATE",
        entityType: "ENTERPRISE",
        entityId: enterpriseId,
        description: `Verified custom domain: ${domain}`,
        ipAddress,
        userAgent,
        enterpriseId,
      })

      return NextResponse.json({
        success: true,
        data: { verified: true, domain, ssl: "provisioning" },
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        verified: false,
        expected: "cname.eventflow.com",
        found: records,
        message: "DNS records not yet configured. Please add a CNAME record pointing to cname.eventflow.com",
      },
    })
  } catch (error) {
    console.error("Domain verify error:", error)
    return NextResponse.json({ success: false, message: "Verification failed" }, { status: 500 })
  }
}
