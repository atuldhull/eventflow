import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { Prisma } from "@prisma/client"
import dns from "dns/promises"
import { z } from "zod/v4"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"
import { createAuditLog, getClientInfo } from "@/lib/audit"
import { clearTenantCache } from "@/lib/tenant"
import { domainSchema, firstIssue } from "@/lib/enterprise-admin"

const bodySchema = z.object({ domain: domainSchema })

/** Where a custom domain's CNAME must point. */
const CNAME_TARGET = (process.env.CUSTOM_DOMAIN_CNAME_TARGET || "cname.eventflow.com").toLowerCase().replace(/\.$/, "")
/** Optional: our public IPs, for apex domains that can't use a CNAME (comma-separated). */
const ALLOWED_IPS = (process.env.CUSTOM_DOMAIN_IPS || "").split(",").map((s) => s.trim()).filter(Boolean)

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

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: firstIssue(parsed.error) }, { status: 400 })
  }
  const { domain } = parsed.data

  try {
    const enterprise = await prisma.enterprise.findFirst({
      where: { id: enterpriseId, deletedAt: null },
      select: { customDomain: true },
    })
    if (!enterprise) {
      return NextResponse.json({ success: false, message: "Enterprise not found" }, { status: 404 })
    }

    // The domain must point at us: a CNAME to our target, or (apex domains) only A records
    // that are our own IPs. Merely resolving somewhere is not proof of control.
    let verified = false
    let records: string[] = []
    try {
      records = (await dns.resolveCname(domain)).map((r) => r.toLowerCase().replace(/\.$/, ""))
      verified = records.includes(CNAME_TARGET)
    } catch {
      try {
        records = await dns.resolve4(domain)
        verified = ALLOWED_IPS.length > 0 && records.length > 0 && records.every((ip) => ALLOWED_IPS.includes(ip))
      } catch {
        verified = false
      }
    }

    if (!verified) {
      return NextResponse.json({
        success: true,
        message: `DNS isn't pointing here yet. Add a CNAME record for ${domain} pointing to ${CNAME_TARGET}, then try again.`,
        data: { verified: false, expected: CNAME_TARGET, found: records },
      })
    }

    try {
      await prisma.enterprise.update({ where: { id: enterpriseId }, data: { customDomain: domain } })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return NextResponse.json({ success: false, message: "This domain is already connected to another account." }, { status: 409 })
      }
      throw error
    }
    if (enterprise.customDomain) clearTenantCache(enterprise.customDomain)
    clearTenantCache(domain)

    const { ipAddress, userAgent } = getClientInfo(request)
    await createAuditLog({
      userId: session.user.id,
      action: "UPDATE",
      entityType: "ENTERPRISE",
      entityId: enterpriseId,
      description: `Verified custom domain: ${domain}`,
      oldValues: { customDomain: enterprise.customDomain },
      newValues: { customDomain: domain },
      ipAddress,
      userAgent,
      enterpriseId,
    })

    return NextResponse.json({
      success: true,
      message: "Domain verified and connected",
      data: { verified: true, domain, ssl: "provisioning" },
    })
  } catch (error) {
    console.error("Domain verify error:", error)
    return NextResponse.json({ success: false, message: "Verification failed" }, { status: 500 })
  }
}
